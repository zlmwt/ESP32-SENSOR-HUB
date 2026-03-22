import React, { useState } from 'react';
import { Cpu, Wifi, Code, ChevronDown, ChevronUp, ExternalLink, Terminal } from 'lucide-react';

export const ESP32ConnectionGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const fbConfig = {
    databaseURL: "https://esp-32-logging-f9d7d-default-rtdb.asia-southeast1.firebasedatabase.app"
  };
  const firebaseRestUrl = `${fbConfig.databaseURL}/sensor_logs.json`;

  const esp32Code = `
#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// --- CONFIGURATION ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
// Direct Firebase Realtime Database REST Endpoint
const char* firebaseRestUrl = "${firebaseRestUrl}";

// DS18B20 Setup
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// MQ2 Setup
#define MQ2PIN 34

// OLED Setup
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("ESP32 Sensor Hub Initializing...");
  
  // Initialize Sensors & Display
  sensors.begin();
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
  }
  display.clearDisplay();
  display.setTextColor(WHITE);
  
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  sensors.requestTemperatures();
  float temp = sensors.getTempCByIndex(0);
  
  // Read MQ2 Gas Sensor
  int gasValue = analogRead(MQ2PIN);
  
  // DEBUG: Print to Serial Monitor
  Serial.print("Temp: "); Serial.print(temp); Serial.print(" C | ");
  Serial.print("Gas Raw: "); Serial.println(gasValue);

  // Update OLED
  display.clearDisplay();
  display.setCursor(0,0);
  display.setTextSize(1);
  display.println("ESP32 Sensor Hub");
  display.println("----------------");
  display.setTextSize(2);
  display.print("T: "); display.print(temp); display.println(" C");
  display.print("G: "); display.print(gasValue); display.println(" PPM");
  display.display();

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    // Firebase REST API uses POST to push new data to a list
    http.begin(firebaseRestUrl);
    http.addHeader("Content-Type", "application/json");

    // Use Firebase Server Value for timestamp
    String jsonPayload = "{\"temperature\":" + String(temp) + 
                         ",\"gas\":" + String(gasValue) + 
                         ",\"timestamp\":{\".sv\":\"timestamp\"}}";

    Serial.print("Pushing to Firebase: ");
    Serial.println(jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);
    
    if (httpResponseCode > 0) {
      Serial.print("Firebase Response: ");
      Serial.println(httpResponseCode);
      String payload = http.getString();
      Serial.println(payload);
    } else {
      Serial.print("Firebase Error: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }
    
    http.end();
  } else {
    Serial.println("WiFi Disconnected");
  }
  
  delay(10000); // Send every 10 seconds
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
            <p className="text-white/40 text-sm">DS18B20 + MQ2 + OLED 0.96" Setup</p>
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
                  <span><strong>DS18B20:</strong> VCC to 3.3V, GND to GND, Data to <strong>GPIO 4</strong> (with 4.7k resistor).</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] mt-0.5">2</div>
                  <span><strong>MQ2:</strong> VCC to 5V, GND to GND, Analog Out to <strong>GPIO 34</strong>.</span>
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
                  DallasTemperature & OneWire
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <div className="flex items-center gap-3 text-emerald-400 font-bold mb-2">
                <ExternalLink size={18} />
                <h4 className="text-sm">Direct Firebase Connection</h4>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                The code above connects <strong>directly</strong> to your Firebase Realtime Database using the REST API. 
                This means your ESP32 pushes data straight to the cloud, and this web application listens for those 
                changes in real-time. No intermediate server is required for the data flow!
              </p>
            </div>

            <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-3 text-amber-400 font-bold mb-2">
                <AlertTriangle size={18} />
                <h4 className="text-sm">Troubleshooting: Gas is 0?</h4>
              </div>
              <ul className="text-[10px] text-white/60 space-y-2 list-disc pl-4">
                <li><strong>Warm-up Time:</strong> MQ2 sensors require 24-48 hours of "burn-in" time for first use, and 2-3 minutes of warm-up every time they power on.</li>
                <li><strong>Sensitivity:</strong> Adjust the small blue potentiometer on the back of the MQ2 module. If it's turned all the way down, it will always return 0.</li>
                <li><strong>Wiring:</strong> Ensure MQ2 Analog Out is connected to <strong>GPIO 34</strong>. Check that the sensor has a solid 5V power supply.</li>
                <li><strong>Firebase Rules:</strong> Ensure your Realtime Database rules allow write access to <code>sensor_logs</code>. For testing, you can use: <code>{'{".read": true, ".write": true}'}</code> (but secure them for production!).</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AlertTriangle = ({ size, className = "" }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const CheckCircle = ({ size, className }: { size: number, className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
