/*
  ===================================================================
  TURBINA EÓLICA - CÓDIGO ESTÁNDAR PARA ARDUINO LEONARDO (PIN 5)
  Control universal de Servo de Rotación Continua MG90S
  ===================================================================
  Comportamiento estándar de Servo:
    - 90 grados  = DETENIDO (Stop / Velocidad 0)
    - 95 a 180   = GIRO HACIA ADELANTE (Velocidad creciente)
    - 0 a 85     = Giro inverso
  ===================================================================
*/

#include <Servo.h>

Servo turbineServo;
const int SERVO_PIN = 5;
const int LED_PIN   = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);

  // Inicializar puerto USB serial
  Serial.begin(9600);

  // Conectar servo al Pin 5
  turbineServo.attach(SERVO_PIN);

  // -------------------------------------------------------------
  // PRUEBA FÍSICA DE ARRANQUE (AUTOTEST):
  // Al encender o resetear, el rotor gira 1.2 segundos al 50% de velocidad
  // y luego se detiene. Esto te confirma al 100% que el servo, el Pin 5
  // y la alimentación funcionan físicamente.
  // -------------------------------------------------------------
  turbineServo.write(140);  // Giro de prueba
  delay(1200);
  turbineServo.write(90);   // Detener
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  // Lectura estándar de un número entero enviado por USB Serial
  if (Serial.available() > 0) {
    int valor = Serial.parseInt();

    // Si recibe un valor válido entre 0 y 180:
    if (valor >= 0 && valor <= 180) {
      turbineServo.write(valor);
      
      // Encender LED 13 si el motor está girando
      if (valor == 90) {
        digitalWrite(LED_PIN, LOW);
      } else {
        digitalWrite(LED_PIN, HIGH);
      }
    }
  }
}
