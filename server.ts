import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import dotenv from "dotenv";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

dotenv.config();

// Initialize Firebase for server-side logging
const firebaseConfig = {
  apiKey: process.env.GEMINI_API_KEY, // Use existing key or provide specific one
  authDomain: `${process.env.PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.PROJECT_ID,
  appId: process.env.APP_ID,
};

// We'll use the client-side config if available, otherwise fallback to env
const fbConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : firebaseConfig;
const fbApp = initializeApp(fbConfig);
const db = getFirestore(fbApp);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
      const docRef = await addDoc(collection(db, 'sensor_logs'), {
        temperature: tempNum,
        gas: gasNum,
        timestamp: serverTimestamp()
      });
      console.log(`[Server] ESP32 Data logged:`, { temperature: tempNum, gas: gasNum, id: docRef.id });
      res.json({ 
        success: true, 
        id: docRef.id,
        message: "Data logged successfully" 
      });
    } catch (error: any) {
      console.error("[Server] Failed to log ESP32 data:", error);
      
      // Handle specific Firebase errors
      const statusCode = error.code === 'permission-denied' ? 403 : 500;
      const errorMessage = error.code === 'permission-denied' 
        ? "Database permission denied. Please check Firestore security rules."
        : "Failed to log data to the database.";

      res.status(statusCode).json({ 
        error: errorMessage,
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
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("[Server] Vite dev server failed to start, falling back to static serving.");
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Check if file exists before sending
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath);
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();

// Export for Vercel
export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
