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

  // Email Notification API
  app.post("/api/notify", async (req, res) => {
    const { level, temperature, gas, timestamp } = req.body;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("[Server] Email configuration missing. Skipping notification.");
      return res.status(500).json({ error: "Email configuration missing" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: `"ESP32 Sensor Hub" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER,
        subject: `⚠️ SENSOR ALERT: ${level} Detected!`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: ${level === 'Dangerous' ? '#ef4444' : '#f97316'};">
              ${level} Alert Detected
            </h2>
            <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
            <p><strong>Temperature:</strong> ${temperature.toFixed(2)}°C</p>
            <p><strong>Gas Concentration:</strong> ${gas.toFixed(0)} PPM</p>
            <hr />
            <p style="color: #666; font-size: 12px;">
              This is an automated alert from your ESP32 Sensor Hub. Please check the dashboard for more details.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`[Server] Notification email sent for ${level} risk.`);
      res.json({ success: true });
    } catch (error) {
      console.error("[Server] Failed to send email:", error);
      res.status(500).json({ error: "Failed to send email" });
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
