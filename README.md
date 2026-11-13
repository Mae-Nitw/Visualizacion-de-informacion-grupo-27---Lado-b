# Proyecto InfoVis: Turbinas Físicas con Protobject y Fichas Físicas

Este proyecto conecta la visualización web de la transición energética en América (2000–2025) con un **modelo físico tangible** usando **Protobject**:
- **Cero servidores Python ni comandos en terminal**: Todo corre 100% en el navegador web con Protobject.
- **Sin necesidad de reprogramar los Arduinos**: La página web en Chrome/Edge se conecta directamente a los Arduinos Leonardo por USB mediante Web Serial con un solo clic.
- **Fichas físicas reales sobre mapa impreso**:
  - Imprimes la imagen del mapa de América (`mapa_impreso.jpg`) sobre una mesa.
  - Imprimes las 2 fichas físicas circulares (`printables/fichas_print.html`): **Ficha 1 (Roja)** para Turbina 1 y **Ficha 2 (Verde)** para Turbina 2.
  - El celular apunta con su cámara al mapa: la pantalla muestra la silueta del mapa superpuesta con baja opacidad para alinear la cámara fácilmente con el papel de la mesa.
  - Al colocar físicamente una ficha sobre un país, la cámara la detecta en tiempo real y la turbina eólica correspondiente acelera año a año (2000 a 2025) según el porcentaje de energía eólica (`share %`) de ese país.
  - Al llegar a 2025, se queda girando constante a ese régimen.
  - Ambas fichas y turbinas funcionan 100% independientes para comparar dos países físicamente.
  - Al levantar la ficha física de la mesa, la turbina se detiene.

---

## 🛠️ Cómo Usar el Sistema

### 1. Imprimir el Mapa y las Fichas Físicas
1. Imprime la imagen [mapa_impreso.jpg](file:///c:/Users/antua/Desktop/idea%202%20proyecto%20infovis/Visualizacion-de-informacion-grupo-27---Lado-b/mapa_impreso.jpg) en papel (tamaño carta o póster) y colócalo en tu mesa.
2. Abre [fichas_print.html](file:///c:/Users/antua/Desktop/idea%202%20proyecto%20infovis/Visualizacion-de-informacion-grupo-27---Lado-b/printables/fichas_print.html) en tu navegador, haz clic en **🖨️ Imprimir Fichas Físicas** y recorta los 2 círculos:
   - **Ficha 1 (Roja)**: Controla la Turbina 1 (Arduino A - Pin 5).
   - **Ficha 2 (Verde)**: Controla la Turbina 2 (Arduino B - Pin 5).

### 2. Abrir la Visualización en el Computador
1. Abre [index.html](file:///c:/Users/antua/Desktop/idea%202%20proyecto%20infovis/Visualizacion-de-informacion-grupo-27---Lado-b/index.html) en Google Chrome o Microsoft Edge.
2. En la esquina inferior derecha verás el panel de **Turbinas Físicas Protobject** con aspas animadas.
3. Conecta tus 2 Arduinos Leonardo al PC por USB y haz clic en **🔌 Conectar USB** para la Turbina 1 y Turbina 2 (no necesitas subir código C++ al Arduino).

### 3. Escanear con el Celular
1. Escanea el código QR que genera Protobject en la pantalla del PC para abrir `scanner.html` en tu celular.
2. El celular abrirá la cámara trasera con la silueta azul del mapa superpuesta semitransparente.
3. Encuadra la cámara del celular sobre el mapa impreso en tu mesa (puedes ajustar el deslizador de opacidad si lo deseas).
4. **Mueve con tus manos las fichas físicas sobre el mapa**:
   - Al colocar la Ficha 1 física sobre un país (ej. Chile), la cámara la detectará con una mira en pantalla y la Turbina 1 comenzará su secuencia acelerando de 2000 a 2025.
   - Al colocar la Ficha 2 física sobre otro país (ej. Brasil), la Turbina 2 comenzará su propia secuencia de forma independiente.
   - Al levantar una ficha física de la mesa, la turbina respectiva se frena.
