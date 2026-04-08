import React, { useState } from 'react';
import { Cpu, Wifi, Code, ChevronDown, ChevronUp, ExternalLink, Terminal } from 'lucide-react';

export const ESP32ConnectionGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const esp32Code = `
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// --- CONFIGURATION ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "https://esp-32-sensor-hub.vercel.app/api/esp32/log";

// DHT22 Setup
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// HW-390 Soil Moisture Setup
#define SOIL_PIN 34

// OLED Setup
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(115200);
  
  // Initialize Sensors & Display
  dht.begin();
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
  }
  display.clearDisplay();
  display.setTextColor(WHITE);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void loop() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  int soilRaw = analogRead(SOIL_PIN);
  // Map raw value (0-4095) to percentage (0-100)
  // Note: Capacitive sensors usually output lower voltage when wet
  int soilPercent = map(soilRaw, 4095, 1500, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  // Update OLED
  display.clearDisplay();
  display.setCursor(0,0);
  display.setTextSize(1);
  display.println("ESP32 Sensor Hub");
  display.println("----------------");
  display.setTextSize(1);
  display.print("Temp: "); display.print(temp); display.println(" C");
  display.print("Hum:  "); display.print(hum); display.println(" %");
  display.print("Soil: "); display.print(soilPercent); display.println(" %");
  display.display();

  if (WiFi.status() == WL_CONNECTED && !isnan(temp) && !isnan(hum)) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"temperature\":" + String(temp) + 
                         ",\"humidity\":" + String(hum) +
                         ",\"soil\":" + String(soilPercent) + "}";

    int httpResponseCode = http.POST(jsonPayload);
    http.end();
  }
  
  delay(5000);
}
`;

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-8">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-8 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-2xl">
            <Cpu className="text-emerald-400" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Connect Real ESP32</h2>
            <p className="text-white/40 text-sm">DHT22 + HW-390 + OLED 0.96" Setup</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="text-white/40" /> : <ChevronDown className="text-white/40" />}
      </button>

      {isOpen && (
        <div className="p-8 pt-0 border-t border-white/10 space-y-8">
          {/* Hardware Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-xs">
                <Wifi size={14} />
                <span>1. Hardware Wiring</span>
              </div>
              <ul className="space-y-3 text-white/60 text-sm">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] mt-0.5">1</div>
                  <span><strong>DHT22:</strong> VCC to 3.3V, GND to GND, Data to <strong>GPIO 4</strong> (with 10k pull-up).</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] mt-0.5">2</div>
                  <span><strong>HW-390:</strong> VCC to 3.3V, GND to GND, Analog Out to <strong>GPIO 34</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] mt-0.5">3</div>
                  <span><strong>OLED (I2C):</strong> VCC to 3.3V, GND to GND, SCL to <strong>GPIO 22</strong>, SDA to <strong>GPIO 21</strong>.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-xs">
                <Terminal size={14} />
                <span>2. Required Libraries</span>
              </div>
              <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-2">
                <p className="text-xs text-white/60 flex items-center gap-2">
                  <CheckCircle size={12} className="text-emerald-500" />
                  DHT sensor library (Adafruit)
                </p>
                <p className="text-xs text-white/60 flex items-center gap-2">
                  <CheckCircle size={12} className="text-emerald-500" />
                  Adafruit SSD1306 & Adafruit GFX
                </p>
                <p className="text-xs text-white/60 flex items-center gap-2">
                  <CheckCircle size={12} className="text-emerald-500" />
                  WiFi & HTTPClient (Built-in)
                </p>
              </div>
            </div>
          </div>

          {/* Arduino Code */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-xs">
                <Code size={14} />
                <span>3. Arduino Sketch</span>
              </div>
              <button 
                onClick={() => navigator.clipboard.writeText(esp32Code)}
                className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-white/60 transition-colors"
              >
                Copy Code
              </button>
            </div>
            <div className="relative group">
              <pre className="bg-black/40 rounded-2xl p-6 text-[11px] font-mono text-emerald-300/80 overflow-x-auto border border-white/5 max-h-[400px] scrollbar-thin scrollbar-thumb-white/10">
                {esp32Code}
              </pre>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-emerald-500 text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg">
                  C++ / ARDUINO
                </div>
              </div>
            </div>
          </div>

          {/* API Endpoint Note */}
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <div className="flex items-center gap-3 text-emerald-400 font-bold mb-2">
              <ExternalLink size={18} />
              <h4 className="text-sm">Important Note on API Endpoint</h4>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">
              The code above uses a dedicated endpoint <code>/api/esp32/log</code>. 
              This endpoint is designed to receive raw JSON from your ESP32 and securely store it in Realtime Database. 
              <strong>New:</strong> Alerts and notifications are now processed on the server, meaning you will receive Telegram/Email alerts even if this browser tab is closed!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckCircle = ({ size, className }: { size: number, className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
