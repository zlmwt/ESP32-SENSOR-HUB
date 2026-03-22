import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import dotenv from "dotenv";
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, serverTimestamp } from 'firebase/database';
import fs from 'fs';
import { createServer as createViteServer } from "vite";

dotenv.config();

// Load Firebase config from the same source as the client
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let fbConfig = {};
try {
  if (fs.existsSync(configPath)) {
    fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (err) {
  console.error("[Server] Failed to load firebase-applet-config.json:", err);
}

// Initialize Firebase for server-side logging
if (Object.keys(fbConfig).length === 0) {
  console.warn("[Server] Firebase configuration is empty. Firebase features will be disabled.");
}
const fbApp = initializeApp(fbConfig);
// @ts-ignore - databaseURL might be in the config
const db = getDatabase(fbApp, fbConfig.databaseURL);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

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
      const logsRef = ref(db, 'sensor_logs');
      const newLogRef = await push(logsRef, {
        temperature: tempNum,
        gas: gasNum,
        timestamp: serverTimestamp()
      });
      
      console.log(`[Server] ESP32 Data logged:`, { temperature: tempNum, gas: gasNum, id: newLogRef.key });
      res.json({ 
        success: true, 
        id: newLogRef.key,
        message: "Data logged successfully" 
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

  // Helper for Telegram Notifications
  const sendTelegramMessage = async (message: string) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.warn("[Server] Telegram configuration missing. Skipping notification.");
      return false;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error("[Server] Telegram API error:", error);
        return false;
      }

      console.log("[Server] Telegram notification sent.");
      return true;
    } catch (error) {
      console.error("[Server] Failed to send Telegram message:", error);
      return false;
    }
  };

  // Notification API (Updated for Telegram and Frequency)
  app.post("/api/notify", async (req, res) => {
    const { type, level, temperature, gas, timestamp, frequency = 'minute' } = req.body;

    // Check frequency (simple in-memory check for demo, ideally should be in DB)
    // For this app, we'll just send it and let the client handle the throttling logic
    // or implement a simple server-side throttle if needed.
    // However, the request says "in the web there is a setting", so the client will pass the frequency.
    
    let message = "";
    if (type === 'alert') {
      const emoji = level === 'Dangerous' ? '🚨' : '⚠️';
      message = `${emoji} <b>SENSOR ALERT: ${level}</b>\n\n` +
                `<b>Time:</b> ${new Date(timestamp).toLocaleString()}\n` +
                `<b>Temp:</b> ${temperature.toFixed(2)}°C\n` +
                `<b>Gas:</b> ${gas.toFixed(0)} PPM\n\n` +
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

    if (!message) return res.status(400).json({ error: "Invalid notification type" });

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

    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      const vite = await createViteServer({
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
