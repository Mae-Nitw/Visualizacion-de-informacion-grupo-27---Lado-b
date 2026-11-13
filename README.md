# Proyecto InfoVis: Turbinas Eólicas Físicas con Protobject

Este proyecto conecta la visualización web de la transición energética en América (2000–2025) con un **modelo físico tangible** utilizando **Protobject**:
- **Sin servidores backend complejos ni configuración de redes locales**.
- **Protobject Framework**: Conecta el navegador del PC con el smartphone escaneando un código QR generado automáticamente.
- **Web Serial API (Chrome/Edge)**: Conecta directamente los 2 Arduinos Leonardo por USB desde el navegador con un solo clic.
- **2 Rotores MG90S de rotación continua**: Conectados al **Pin 5** de cada Arduino Leonardo para simular las aspas de las turbinas eólicas.

---

## 🛠️ Arquitectura 100% Web con Protobject

```
 [ Celular (scanner.html) ]  <--- Escanea QR generado por Protobject
       │
       ▼ (Mensajes en la nube vía Protobject.Core.send)
 [ Laptop / PC (index.html) ]
       │
       ├──── WebSerial USB ────> [ Arduino Leonardo 1 (Pin 5) ] -> Turbina 1
       └──── WebSerial USB ────> [ Arduino Leonardo 2 (Pin 5) ] -> Turbina 2
```

---

## 🚀 Pasos de Puesta en Marcha

### 1. Cargar el Firmware en los 2 Arduinos Leonardo
1. Abre [turbina_leonardo.ino](file:///c:/Users/antua/Desktop/idea%202%20proyecto%20infovis/Visualizacion-de-informacion-grupo-27---Lado-b/arduino/turbina_leonardo/turbina_leonardo.ino) en el Arduino IDE.
2. Conecta el primer Arduino Leonardo, selecciona la placa **Arduino Leonardo** y cárgalo.
3. Conecta el segundo Arduino Leonardo y cárgalo.
*(El pin de control del micro servo es el **Pin 5**).*

### 2. Abrir la Visualización en el PC
1. Abre `index.html` en Google Chrome o Microsoft Edge (puedes usar una extensión como Live Server en VS Code o simplemente abrir el archivo).
2. Verás el panel flotante inferior derecho: **💨 Turbinas Físicas Protobject**.
3. Haz clic en **🔌 Conectar USB** para la Turbina 1 y selecciona el puerto de tu primer Leonardo.
4. Haz clic en **🔌 Conectar USB** para la Turbina 2 y selecciona el puerto de tu segundo Leonardo.

### 3. Conectar el Celular vía Protobject
1. En la pantalla del PC, Protobject desplegará el **código QR** para vincular el dispositivo.
2. Abre la cámara de tu celular y escanea el código QR.
3. El celular abrirá instantáneamente la pantalla de control `scanner.html`.
4. Elige **🔵 Ficha 1** o **🟢 Ficha 2** y apunta la cámara o toca cualquier país del mapa de América:
   - Su turbina respectiva comenzará a girar desde el año 2000, acelerando año a año hasta 2025 según el porcentaje de energía eólica (`share %`) de ese país.
   - Al llegar al último año, se quedará girando fija a esa velocidad hasta cambiar o retirar la ficha con la cruz `✕`.
   - Ambas turbinas funcionan 100% independientes para comparar dos países frente a frente.

---

## 🔌 Conexión de Pines (Arduino Leonardo - Pin 5)

| Pin del Servo MG90S | Color Habitual | Conexión en Arduino Leonardo |
| :--- | :--- | :--- |
| **GND** | Marrón o Negro | Pin **GND** |
| **VCC (+5V)** | Rojo | Pin **5V** (o fuente externa 5V recomendada) |
| **Señal** | Naranja o Amarillo | **Pin Digital 5** |
