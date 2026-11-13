# Guía de Conexión de Hardware - Turbinas Físicas

## Componentes
- 2x Placas **Arduino Leonardo R3** (Microcontrolador ATmega32U4).
- 2x Micro Servos **MG90S de rotación continua** (360°).
- Estructura física que simule las aspas de las turbinas eólicas fijadas al rotor de cada servo.
- Cable USB para cada Arduino hacia el PC / Laptop.

---

## Esquema de Conexiones por cada Turbina

Cada servo tiene un conector hembra de 3 pines:

| Pin del Servo | Color Habitual | Conexión Arduino Leonardo |
| :--- | :--- | :--- |
| **GND** (Tierra) | Marrón o Negro | Pin **GND** |
| **VCC** (+5V) | Rojo | Pin **5V** (o fuente externa 5V) |
| **Señal** (PWM) | Naranja o Amarillo | **Pin Digital 5** |

> [!WARNING]
> **Alimentación Eléctrica Recomendada**:
> Si conectas dos servos de rotación continua alimentados directamente desde los pines de 5V de los dos Arduinos por USB, los picos de arranque del motor pueden provocar caídas de voltaje que reinicien el Arduino Leonardo.
> **Mejor práctica**: Conecta los cables negros (GND) al GND del Arduino, los cables amarillos al Pin 5, y los cables rojos a una fuente externa de 5V (o un cargador USB con conector adaptado), asegurándote de unir todas las tierras (GND) para que haya una referencia común.

---

## Carga del Firmware (Arduino IDE)
1. Abre el Arduino IDE.
2. Abre el archivo `turbina_leonardo.ino`.
3. En **Herramientas > Placa**, selecciona **Arduino Leonardo**.
4. En **Herramientas > Puerto**, selecciona el puerto COM correspondiente (ej. `COM3` para Turbina 1 y `COM4` para Turbina 2).
5. Presiona **Subir** (Upload).
6. Repite el mismo proceso para el segundo Arduino Leonardo.

