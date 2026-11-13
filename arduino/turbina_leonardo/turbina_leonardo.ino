/*
  ===================================================================
  TURBINA EÓLICA - ARDUINO LEONARDO R3 (Control de Rotor Continuo MG90S)
  Proyecto: Visualización de Información Física - Grupo 27
  Pin de Control: Pin 5 (PWM / Servo)
  ===================================================================
*/

#include <Servo.h>

Servo turbineServo;

// Pin de señal del micro servo MG90S
const int SERVO_PIN = 5;
const int LED_PIN   = 13; // LED indicador de estado

// Calibración de pulsos en microsegundos para MG90S de rotación continua:
// - STOP_PULSE: Punto neutro donde el rotor se detiene por completo (habitualmente 1500 us).
// - MIN_PULSE:  Velocidad mínima hacia adelante (justo fuera de la zona muerta, ~1535 - 1550 us).
// - MAX_PULSE:  Velocidad máxima hacia adelante (~1900 - 2000 us).
const int STOP_PULSE = 1500;
const int MIN_PULSE  = 1545;
const int MAX_PULSE  = 1920;

// Variables de estado
float currentSpeedPercent = 0.0;
unsigned long lastSerialTime = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Inicializar comunicación Serial (USB nativo del Leonardo)
  Serial.begin(115200);
  
  // En Arduino Leonardo, esperar brevemente a que el puerto USB se abra
  while (!Serial && millis() < 2500) {
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }

  // Inicializar servo en Pin 5
  turbineServo.attach(SERVO_PIN);
  stopTurbine();

  Serial.println("STATUS:READY");
}

void loop() {
  // Lectura de comandos Serial enviados por el servidor puente
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.length() == 0) return;

    digitalWrite(LED_PIN, HIGH);
    lastSerialTime = millis();

    // 1. Comando de velocidad: SPEED:XX.X (0.0 a 100.0%)
    if (line.startsWith("SPEED:")) {
      float speed = line.substring(6).toFloat();
      setSpeed(speed);
      Serial.print("ACK:SPEED:");
      Serial.println(currentSpeedPercent);
    }
    // 2. Comando de parada de emergencia: STOP
    else if (line == "STOP") {
      stopTurbine();
      Serial.println("ACK:STOP");
    }
    // 3. Identificación y Ping: PING
    else if (line == "PING") {
      Serial.println("PONG:TURBINE_LEONARDO");
    }
    // 4. Test rápido: TEST (gira 2 segundos al 50% y frena)
    else if (line == "TEST") {
      Serial.println("RUNNING_TEST");
      setSpeed(40.0);
      delay(2000);
      stopTurbine();
      Serial.println("TEST_DONE");
    }
    else {
      Serial.print("ERR:UNKNOWN_COMMAND:");
      Serial.println(line);
    }
  }

  // Apagar LED de actividad después de 50ms de la última recepción
  if (millis() - lastSerialTime > 50) {
    digitalWrite(LED_PIN, LOW);
  }
}

// Establece la velocidad de rotación entre 0% y 100%
void setSpeed(float percent) {
  if (percent <= 0.5) {
    stopTurbine();
    return;
  }

  if (percent > 100.0) percent = 100.0;
  currentSpeedPercent = percent;

  // Mapear linealmente el porcentaje al pulso del servo
  int pulse = MIN_PULSE + (int)((MAX_PULSE - MIN_PULSE) * (percent / 100.0));
  turbineServo.writeMicroseconds(pulse);
}

// Detiene el giro del rotor
void stopTurbine() {
  currentSpeedPercent = 0.0;
  turbineServo.writeMicroseconds(STOP_PULSE);
}

