import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import dotenv from "dotenv";
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, serverTimestamp, get, set, query as dbQuery, orderByChild, limitToLast } from 'firebase/database';
import fs from 'fs';
// @ts-ignore - createViteServer will be imported dynamically for dev only
let createViteServer: any;

dotenv.config();

console.log(`[Server] Environment variables loaded. Telegram Token present: ${!!process.env.TELEGRAM_BOT_TOKEN}, Chat ID present: ${!!process.env.TELEGRAM_CHAT_ID}`);

// Load Firebase config from the same source as the client
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let fbConfig: any = {};

// Try to load from environment variables first (best for Vercel)
if (process.env.FIREBASE_CONFIG) {
  try {
    fbConfig = JSON.parse(process.env.FIREBASE_CONFIG);
    console.log("[Server] Firebase config loaded from environment variable.");
  } catch (e) {
    console.error("[Server] Failed to parse FIREBASE_CONFIG environment variable:", e);
  }
}

// Fallback to file if environment variable is missing or failed
if (Object.keys(fbConfig).length === 0) {
  try {
    if (fs.existsSync(configPath)) {
      fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      console.log("[Server] Firebase config loaded from file.");
    }
  } catch (err) {
    console.error("[Server] Failed to load firebase-applet-config.json:", err);
  }
}

// Initialize Firebase for server-side logging
if (Object.keys(fbConfig).length === 0) {
  console.warn("[Server] Firebase configuration is empty. Firebase features will be disabled.");
}
const fbApp = initializeApp(fbConfig);
// @ts-ignore - databaseURL might be in the config or use default from projectId
const db = getDatabase(fbApp, fbConfig.databaseURL || `https://${fbConfig.projectId}-default-rtdb.firebaseio.com/`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Helper for Risk Analysis (Server-side)
  const getRiskLevel = (temp: number, ppm: number) => {
    const getTempRisk = (t: number) => {
      if (t >= 18 && t <= 30) return 0; // Normal
      if ((t > 30 && t <= 40) || (t >= 10 && t < 18)) return 1; // Low
      if ((t > 40 && t <= 50) || (t >= 0 && t < 10)) return 2; // Medium
      return 3; // Dangerous
    };
    const getGasRisk = (p: number) => {
      if (p < 400) return 0; // Clean Air (200-400)
      if (p >= 400 && p < 1000) return 1; // Normal Indoor (300-800)
      if (p >= 1000 && p < 5000) return 2; // Smoke Detected (1000-5000)
      return 3; // Gas Leak (5000+)
    };
    const levels = ['Normal', 'Low Risk', 'Medium Risk', 'Dangerous'];
    const maxRisk = Math.max(getTempRisk(temp), getGasRisk(ppm));
    return levels[maxRisk];
  };

  // ESP32 Data Logging API
  app.post("/api/esp32/log", async (req, res) => {
    const { temperature, gas } = req.body;
    
    // Validate presence
    if (temperature === undefined || gas === undefined) {
      const missing = [];
      if (temperature === undefined) missing.push("temperature");
      if (gas === undefined) missing.push("gas");
      return res.status(400).json({ 
        error: `Missing required fields: ${missing.join(", ")}`,
        received: req.body 
      });
    }

    // Validate types
    const tempNum = Number(temperature);
    const gasNum = Number(gas);

    if (isNaN(tempNum) || isNaN(gasNum)) {
      const invalid = [];
      if (isNaN(tempNum)) invalid.push("temperature");
      if (isNaN(gasNum)) invalid.push("gas");
      return res.status(400).json({ 
        error: `Invalid data format for: ${invalid.join(", ")}. Values must be numeric.`,
        received: { temperature, gas }
      });
    }

    try {
      // 1. Load settings to check if logging is enabled
      const settingsRef = ref(db, 'settings/logging');
      const settingsSnap = await get(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.val() : { isLogging: false, notificationFrequency: 'minute' };

      // 2. Log the data ONLY if logging is enabled
      let newLogRef = null;
      if (settings.isLogging) {
        const logsRef = ref(db, 'sensor_logs');
        
        // Get last log to check for reconnection
        const lastLogQuery = dbQuery(logsRef, orderByChild('timestamp'), limitToLast(1));
        const lastLogSnap = await get(lastLogQuery);
        let lastLogTime = 0;
        if (lastLogSnap.exists()) {
          const lastLog = Object.values(lastLogSnap.val())[0] as any;
          lastLogTime = lastLog.timestamp || 0;
        }

        newLogRef = await push(logsRef, {
          temperature: tempNum,
          gas: gasNum,
          timestamp: serverTimestamp()
        });
        
        const now = Date.now();
        console.log(`[Server] ESP32 Data logged:`, { temperature: tempNum, gas: gasNum, id: newLogRef.key });

        // 3. Check for Reconnection (if gap > 5 minutes)
        if (lastLogTime > 0 && (now - lastLogTime > 5 * 60 * 1000)) {
          console.log("[Server] System reconnected after a gap. Sending status notification...");
          await triggerNotification({
            type: 'status',
            level: 'Connected',
            timestamp: now
          });
        }
      } else {
        console.log(`[Server] ESP32 Data received but logging is OFF:`, { temperature: tempNum, gas: gasNum });
      }

      // 4. Perform Risk Analysis & Notifications (Server-side) - ALWAYS check for risk
      const riskLevel = getRiskLevel(tempNum, gasNum);
      
      if (riskLevel === 'Dangerous' || riskLevel === 'Medium Risk') {
        // We always notify for high risk levels even if logging is off, 
        // as these are critical safety alerts.
        const lastSentRef = ref(db, 'settings/notifications/lastSent');
        const lastSentSnap = await get(lastSentRef);
        const lastSent = lastSentSnap.exists() ? lastSentSnap.val() : 0;
        
        const now = Date.now();
        const frequency = settings.notificationFrequency || 'minute';
        const cooldowns: Record<string, number> = {
          minute: 60 * 1000,
          hour: 60 * 60 * 1000,
          day: 24 * 60 * 60 * 1000
        };
        
        if (now - lastSent > cooldowns[frequency]) {
          console.log(`[Server] Alert condition met (${riskLevel}). Sending notification...`);
          
          // Construct notification payload
          const payload = {
            type: 'alert',
            level: riskLevel,
            temperature: tempNum,
            gas: gasNum,
            timestamp: now
          };

          await triggerNotification(payload);
          
          // Update last sent time
          await set(lastSentRef, now);
        } else {
          console.log(`[Server] Alert skipped due to cooldown (${frequency}). Last sent: ${new Date(lastSent).toLocaleString()}`);
        }
      }

      res.json({ 
        success: true, 
        id: newLogRef?.key || null,
        message: settings.isLogging ? "Data logged successfully" : "Data received (logging off)" 
      });
    } catch (error: any) {
      console.error("[Server] Failed to log ESP32 data:", error);
      
      res.status(500).json({ 
        error: "Failed to log data to the database.",
        code: error.code || "unknown_error",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Helper to trigger notification (Telegram/Email)
  const triggerNotification = async (payload: any) => {
    console.log('[Server] triggerNotification called with:', payload);
    const { type, level, temperature, gas } = payload;
    const timestamp = payload.timestamp || Date.now();
    let message = "";
    
    if (type === 'alert') {
      const emoji = level === 'Dangerous' ? '🚨' : '⚠️';
      const tempStr = typeof temperature === 'number' ? temperature.toFixed(2) : (Number(temperature)?.toFixed(2) ?? '0.00');
      const gasStr = typeof gas === 'number' ? gas.toFixed(0) : (Number(gas)?.toFixed(0) ?? '0');
      
      message = `${emoji} <b>SENSOR ALERT: ${level}</b>\n\n` +
                `<b>Time:</b> ${new Date(timestamp).toLocaleString()}\n` +
                `<b>Temp:</b> ${tempStr}°C\n` +
                `<b>Gas:</b> ${gasStr} PPM\n\n` +
                `<i>Please check the dashboard immediately.</i>`;
    } else if (type === 'status') {
      const emoji = level === 'Connected' ? '✅' : '❌';
      message = `${emoji} <b>SYSTEM STATUS: ${level}</b>\n\n` +
                `<b>Time:</b> ${new Date(timestamp).toLocaleString()}\n` +
                `The ESP32 has been <b>${level.toLowerCase()}</b>.`;
    } else if (type === 'logging') {
      const emoji = level === 'Started' ? '⏺️' : '⏹️';
      message = `${emoji} <b>LOGGING STATUS: ${level}</b>\n\n` +
                `<b>Time:</b> ${new Date(timestamp).toLocaleString()}\n` +
                `Data recording has <b>${level.toLowerCase()}</b>.`;
    }

    if (!message) return false;

    const success = await sendTelegramMessage(message);
    
    // Also try email if configured
    if (process.env.SMTP_USER && process.env.SMTP_PASS && type === 'alert') {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const mailOptions = {
          from: `"ESP32 Sensor Hub" <${process.env.SMTP_USER}>`,
          to: process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER,
          subject: `⚠️ SENSOR ALERT: ${level} Detected!`,
          html: `<div style="font-family: sans-serif; padding: 20px;"><h2>${level} Alert</h2><p>${message.replace(/\n/g, '<br>')}</p></div>`,
        };
        await transporter.sendMail(mailOptions);
      } catch (e) {
        console.error("[Server] Email failed:", e);
      }
    }
    return success;
  };

  // Helper for Telegram Notifications
  const sendTelegramMessage = async (message: string) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    console.log(`[Server] Attempting to send Telegram message. Token exists: ${!!token}, Chat ID exists: ${!!chatId}`);

    if (!token || !chatId) {
      console.warn("[Server] Telegram configuration missing (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID). Skipping notification.");
      return false;
    }

    try {
      // Check if fetch is available (Node 18+)
      if (typeof fetch === 'undefined') {
        throw new Error("Global fetch is not available. Please ensure you are using Node.js 18 or higher.");
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        console.error(`[Server] Telegram API error (${response.status}):`, responseData);
        return false;
      }

      console.log("[Server] Telegram notification sent successfully.");
      return true;
    } catch (error: any) {
      console.error("[Server] Failed to send Telegram message:", error.message || error);
      return false;
    }
  };

  // Notification API (Updated for Telegram and Frequency)
  app.post("/api/notify", async (req, res) => {
    console.log(`[Server] Received notification request:`, req.body);
    const success = await triggerNotification(req.body);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      const { createServer: createViteServerDynamic } = await import("vite");
      const vite = await createViteServerDynamic({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[Server] Vite dev server middleware active.");
    } catch (e) {
      console.warn("[Server] Vite dev server failed to start, falling back to static serving.");
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application build not found. Please run 'npm run build' first.");
      }
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer().catch(err => {
  console.error("[Server] Critical startup error:", err);
  process.exit(1);
});

// Export for Vercel
export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
