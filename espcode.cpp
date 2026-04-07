#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ═══════════════════════════════════════════════════════════
//  CONFIGURATION - REPLACE THESE VALUES!
// ═══════════════════════════════════════════════════════════

// WiFi Credentials
const char* WIFI_SSID     = "";          //  CHANGE THIS
const char* WIFI_PASSWORD = "";      //  CHANGE THIS

// Supabase Configuration
const char* SUPABASE_URL      = "";  //  CHANGE THIS
const char* SUPABASE_ANON_KEY = "";                
const char* DEVICE_ID         = "";             //  CHANGE THIS

// ═══════════════════════════════════════════════════════════
//  PIN DEFINITIONS - Your Current Setup
// ═══════════════════════════════════════════════════════════

#define DHT_PIN       22        // DHT11 DATA → GPIO22
#define DHT_TYPE      DHT11

#define MQ135_PIN     32        // MQ-135 AO → GPIO26

#define DUST_LED_PIN  27        // GP2Y LED control → GPIO4
#define DUST_VO_PIN   34        // GP2Y analog out → GPIO34


// ═══════════════════════════════════════════════════════════
//  DUST SENSOR TIMING (microseconds)
// ═══════════════════════════════════════════════════════════

#define SAMPLING_TIME   280
#define DELTA_TIME      40
#define SLEEP_TIME      9680


// ═══════════════════════════════════════════════════════════
//  TIMING CONFIGURATION
// ═══════════════════════════════════════════════════════════

unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 600000;  
// 5 minutes (300,000 ms)
// For testing, use 30000 (30 seconds), then change back to 300000


// ═══════════════════════════════════════════════════════════
//  SENSOR OBJECTS
// ═══════════════════════════════════════════════════════════

DHT dht(DHT_PIN, DHT_TYPE);


// ═══════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════

void setup() {

  Serial.begin(115200);
  delay(1000);

  analogSetAttenuation(ADC_11db);

  Serial.println("\n========================================");
  Serial.println("  ESP32 IoT AQI Monitoring System");
  Serial.println("========================================");

  // Initialize sensor pins
  pinMode(DUST_LED_PIN, OUTPUT);
  digitalWrite(DUST_LED_PIN, HIGH); // LED OFF

  // Initialize DHT sensor
  dht.begin();

  // Connect to WiFi
  connectWiFi();

  // Warm up MQ135 sensor
  Serial.println("\n Warming up MQ135 sensor (30 seconds)...");
  delay(30000);

  // Log device boot
  logDeviceStatus("ON", "device_boot");

  Serial.println(" System ready!");
  Serial.println("========================================\n");
}


// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════

void loop() {

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("  WiFi disconnected! Reconnecting...");
    connectWiFi();
  }

  // Send data every SEND_INTERVAL
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    readAndSendSensorData();
    lastSendTime = millis();
  }

  delay(1000);
}


// ═══════════════════════════════════════════════════════════
//  WIFI CONNECTION FUNCTION
// ═══════════════════════════════════════════════════════════

void connectWiFi() {

  Serial.print("🔌 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("\n WiFi Connected!");
    Serial.print(" IP Address: ");
    Serial.println(WiFi.localIP());

    Serial.print(" MAC Address: ");
    Serial.println(WiFi.macAddress());

    Serial.print(" Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

  } else {

    Serial.println("\n WiFi Connection Failed!");
    Serial.println("  Check SSID and password!");

  }
}


// ═══════════════════════════════════════════════════════════
//  READ MQ135 GAS SENSOR → CO2 EQUIVALENT
// ═══════════════════════════════════════════════════════════

float readCO2() {

  int rawValue = analogRead(MQ135_PIN);

  // Convert ADC value to voltage
  float voltage = rawValue * (3.3 / 4095.0);

  Serial.print("MQ135 RAW: ");
  Serial.print(rawValue);
  Serial.print(" | Voltage: ");
  Serial.println(voltage, 3);

  float co2_ppm = map(rawValue, 200, 2000, 400, 5000);

  if (co2_ppm < 400) co2_ppm = 400;
  if (co2_ppm > 5000) co2_ppm = 5000;

  return co2_ppm;
}


// ═══════════════════════════════════════════════════════════
//  READ GP2Y1010 DUST SENSOR → PM2.5
// ═══════════════════════════════════════════════════════════

float readPM25() {

  digitalWrite(DUST_LED_PIN, LOW);
  delayMicroseconds(SAMPLING_TIME);

  int dustRaw = analogRead(DUST_VO_PIN);

  Serial.print("Dust raw: ");
  Serial.println(dustRaw);

  delayMicroseconds(DELTA_TIME);

  digitalWrite(DUST_LED_PIN, HIGH);
  delayMicroseconds(SLEEP_TIME);

  float dustVoltage = dustRaw * (3.3 / 4095.0);
  float baseline = 0.50;

  float dustDensity = (dustVoltage - baseline) / 0.5;

  if (dustDensity < 0) dustDensity = 0;

  float pm25 = dustDensity * 1000;
  pm25 = constrain(pm25, 0, 500);

  return pm25;
}


// ═══════════════════════════════════════════════════════════
//  READ ALL SENSORS AND SEND TO SUPABASE
// ═══════════════════════════════════════════════════════════

void readAndSendSensorData() {

  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║     READING SENSORS                    ║");
  Serial.println("╚════════════════════════════════════════╝");

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {

    Serial.println(" DHT11 Error! Using fallback values...");
    temperature = 25.0;
    humidity = 50.0;

  } else {

    Serial.println(" DHT11 OK");

  }

  Serial.print("     Temperature: ");
  Serial.print(temperature, 1);
  Serial.println(" °C");

  Serial.print("    Humidity: ");
  Serial.print(humidity, 1);
  Serial.println(" %");


  float co2 = readCO2();

  Serial.println(" MQ135 OK");
  Serial.print("    CO2: ");
  Serial.print(co2, 1);
  Serial.println(" ppm");


  float pm25 = readPM25();

  Serial.println(" GP2Y1010 OK");
  Serial.print("   PM2.5: ");
  Serial.print(pm25, 1);
  Serial.println(" µg/m³");


  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║     SENDING TO SUPABASE                ║");
  Serial.println("╚════════════════════════════════════════╝");

  sendToSupabase(pm25, co2, temperature, humidity);
}


// ═══════════════════════════════════════════════════════════
//  SEND DATA TO SUPABASE VIA REST API
// ═══════════════════════════════════════════════════════════

void sendToSupabase(float pm25, float co2, float temp, float humidity) {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(" WiFi not connected! Cannot send data.");
    return;
  }

  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";

  http.begin(url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<256> doc;

  doc["device_id"] = DEVICE_ID;
  doc["pm25"] = round(pm25 * 100) / 100.0;
  doc["co2"] = round(co2 * 100) / 100.0;
  doc["temperature"] = round(temp * 100) / 100.0;
  doc["humidity"] = round(humidity * 100) / 100.0;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.println(" Payload:");
  Serial.println(jsonString);

  int httpCode = http.POST(jsonString);

  if (httpCode > 0) {

    Serial.print("HTTP Response Code: ");
    Serial.println(httpCode);

    if (httpCode == 201) {

      Serial.println(" Data sent successfully!");
      Serial.println(" Check Supabase Table Editor!");

    } else if (httpCode == 401) {

      Serial.println(" Authentication failed!");
      Serial.println("  Check your SUPABASE_ANON_KEY");

    } else if (httpCode == 400) {

      Serial.println(" Bad request!");
      Serial.println("  Check device_id or data format");
      Serial.println(http.getString());

    } else {

      Serial.println("  Unexpected response:");
      Serial.println(http.getString());

    }

  } else {

    Serial.print(" HTTP Request failed! Error: ");
    Serial.println(http.errorToString(httpCode));

  }

  http.end();

  Serial.println("════════════════════════════════════════\n");
}


// ═══════════════════════════════════════════════════════════
//  LOG DEVICE STATUS TO SUPABASE
// ═══════════════════════════════════════════════════════════

void logDeviceStatus(String status, String reason) {

  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/device_status_logs";

  http.begin(url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));

  StaticJsonDocument<128> doc;

  doc["device_id"] = DEVICE_ID;
  doc["status"] = status;
  doc["reason"] = reason;

  String jsonString;
  serializeJson(doc, jsonString);

  http.POST(jsonString);
  http.end();

  Serial.print(" Device Status Logged: ");
  Serial.println(status);
}