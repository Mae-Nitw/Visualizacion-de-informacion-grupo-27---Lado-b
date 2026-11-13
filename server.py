"""
=============================================================================
SERVIDOR PUENTE FÍSICO: VISUALIZACIÓN DE INFORMACIÓN - GRUPO 27
Conecta el escáner del Celular con los 2 Arduinos Leonardo (Pin 5 - MG90S)
=============================================================================
"""

import os
import sys
import json
import time
import socket
import threading
import argparse
from typing import Dict, Optional, Any

import serial
import serial.tools.list_ports
from flask import Flask, jsonify, request, send_from_directory
import asyncio
import websockets

# Directorio raíz del proyecto
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Cargar base de datos energética
ENERGY_DATA_PATH = os.path.join(BASE_DIR, "energy_data.json")
try:
    with open(ENERGY_DATA_PATH, "r", encoding="utf-8") as f:
        ENERGY_DATA = json.load(f)
    print(f"[OK] Base de datos cargada: {len(ENERGY_DATA)} países disponibles.")
except Exception as e:
    print(f"[ERROR] No se pudo leer {ENERGY_DATA_PATH}: {e}")
    ENERGY_DATA = {}

# Inicializar Flask
app = Flask(__name__, static_folder=BASE_DIR)

# ---------------------------------------------------------------------------
# GESTIÓN DE CONTROLADORES ARDUINO
# ---------------------------------------------------------------------------

class ArduinoTurbine:
    def __init__(self, turbine_id: int, port_name: Optional[str] = None):
        self.turbine_id = turbine_id
        self.port_name = port_name
        self.serial_conn: Optional[serial.Serial] = None
        self.is_connected = False
        self.current_speed = 0.0
        self.current_country: Optional[str] = None
        self.current_year: Optional[int] = None
        self.current_share: float = 0.0
        self.status = "idle"  # idle | animating | holding
        self.animation_thread: Optional[threading.Thread] = None
        self.stop_animation_event = threading.Event()
        self.lock = threading.Lock()

    def connect(self) -> bool:
        if not self.port_name:
            print(f"[TURBINA {self.turbine_id}] Modo SIMULACIÓN (sin puerto asignado).")
            return False

        try:
            self.serial_conn = serial.Serial(
                port=self.port_name,
                baudrate=115200,
                timeout=0.5,
                write_timeout=0.5
            )
            time.sleep(1.8)  # Tiempo de inicialización USB Leonardo
            self.is_connected = True
            print(f"[TURBINA {self.turbine_id}] Conectada exitosamente en {self.port_name}")
            self.send_raw("PING")
            return True
        except Exception as e:
            print(f"[TURBINA {self.turbine_id}] No se pudo conectar a {self.port_name}: {e}")
            self.is_connected = False
            return False

    def send_raw(self, cmd: str):
        if self.serial_conn and self.is_connected:
            try:
                self.serial_conn.write(f"{cmd}\n".encode('ascii'))
                self.serial_conn.flush()
            except Exception as e:
                print(f"[TURBINA {self.turbine_id}] Error escribiendo comando '{cmd}': {e}")
                self.is_connected = False

    def set_speed(self, speed_percent: float):
        speed_percent = max(0.0, min(100.0, speed_percent))
        self.current_speed = speed_percent
        if self.is_connected:
            self.send_raw(f"SPEED:{speed_percent:.1f}")
        else:
            # Mensaje en simulación
            pass

    def stop(self):
        with self.lock:
            self.stop_animation_event.set()
        self.set_speed(0.0)
        self.current_country = None
        self.current_year = None
        self.current_share = 0.0
        self.status = "idle"
        broadcast_state()

    def start_country_sequence(self, country: str):
        """Inicia la animación temporal de 2000 al último año para el país dado."""
        if country not in ENERGY_DATA:
            print(f"[TURBINA {self.turbine_id}] País '{country}' no encontrado en energy_data.")
            return

        with self.lock:
            # Si ya había una animación en curso para esta turbina, detenerla
            self.stop_animation_event.set()
            if self.animation_thread and self.animation_thread.is_alive():
                self.animation_thread.join(timeout=0.5)

            self.stop_animation_event.clear()
            self.current_country = country
            self.status = "animating"

            self.animation_thread = threading.Thread(
                target=self._run_timeline,
                args=(country,),
                daemon=True
            )
            self.animation_thread.start()

    def _run_timeline(self, country: str):
        c_info = ENERGY_DATA[country]
        years = c_info.get("years", [])
        wind_shares = c_info.get("sources", {}).get("Wind", {}).get("share", [])

        if not years or not wind_shares:
            self.stop()
            return

        total_steps = len(years)
        print(f"\n>>> [TURBINA {self.turbine_id}] Iniciando secuencia para '{country}' ({years[0]} - {years[-1]})...")

        for idx in range(total_steps):
            if self.stop_animation_event.is_set():
                print(f"[TURBINA {self.turbine_id}] Secuencia interrumpida.")
                return

            year = years[idx]
            share = wind_shares[idx] if idx < len(wind_shares) else wind_shares[-1]
            
            # Mapeo: 0% eólico = 0% velocidad.
            # 35% eólico = 100% velocidad de rotación.
            MAX_SHARE_REF = 35.0
            calc_speed = (share / MAX_SHARE_REF) * 100.0
            calc_speed = max(0.0, min(100.0, calc_speed))

            self.current_year = year
            self.current_share = share
            self.set_speed(calc_speed)

            # Notificar cambio a todos los clientes (móvil y pantalla)
            broadcast_state()

            # Pausa entre cada año (~350 ms por año -> ~8.7 segundos en total)
            time.sleep(0.35)

        # Fin de la animación: mantener girando en el último año de forma indefinida
        self.status = "holding"
        print(f">>> [TURBINA {self.turbine_id}] Finalizada animación. Manteniendo régimen fijo a {self.current_speed:.1f}% ({country} - {self.current_year})")
        broadcast_state()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "turbine_id": self.turbine_id,
            "port": self.port_name or "SIMULADOR",
            "is_connected": self.is_connected,
            "status": self.status,
            "country": self.current_country,
            "year": self.current_year,
            "share": round(self.current_share, 2),
            "speed": round(self.current_speed, 1)
        }


# Instancias de las dos turbinas
turbine_1 = ArduinoTurbine(turbine_id=1)
turbine_2 = ArduinoTurbine(turbine_id=2)

# ---------------------------------------------------------------------------
# SERVIDOR WEBSOCKETS (Sincronización en tiempo real)
# ---------------------------------------------------------------------------

CONNECTED_WEBSOCKETS = set()
WS_LOOP: Optional[asyncio.AbstractEventLoop] = None

def get_current_system_state():
    return {
        "type": "STATE_UPDATE",
        "turbines": {
            "1": turbine_1.to_dict(),
            "2": turbine_2.to_dict()
        }
    }

def broadcast_state():
    """Envía el estado actual de las dos turbinas a todos los clientes conectados."""
    if not WS_LOOP or not CONNECTED_WEBSOCKETS:
        return

    payload = json.dumps(get_current_system_state())
    for ws in list(CONNECTED_WEBSOCKETS):
        try:
            asyncio.run_coroutine_threadsafe(ws.send(payload), WS_LOOP)
        except Exception:
            pass

async def ws_handler(websocket):
    CONNECTED_WEBSOCKETS.add(websocket)
    print(f"[WS] Cliente conectado desde {websocket.remote_address}")
    try:
        # Enviar estado inicial inmediato
        await websocket.send(json.dumps(get_current_system_state()))

        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                t_id = int(data.get("turbine", 1))
                target_turbine = turbine_1 if t_id == 1 else turbine_2

                if action == "set_country":
                    country = data.get("country")
                    if country:
                        target_turbine.start_country_sequence(country)
                elif action == "remove":
                    target_turbine.stop()
                elif action == "ping":
                    await websocket.send(json.dumps({"type": "PONG"}))
            except Exception as e:
                print(f"[WS Error procesando mensaje]: {e}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        CONNECTED_WEBSOCKETS.discard(websocket)
        print("[WS] Cliente desconectado.")

def start_websocket_server(host: str, port: int):
    global WS_LOOP
    WS_LOOP = asyncio.new_event_loop()
    asyncio.set_event_loop(WS_LOOP)
    start_server = websockets.serve(ws_handler, host, port)
    WS_LOOP.run_until_complete(start_server)
    print(f"[OK] Servidor WebSocket activo en ws://{host}:{port}")
    WS_LOOP.run_forever()


# ---------------------------------------------------------------------------
# RUTAS FLASK / API HTTP
# ---------------------------------------------------------------------------

@app.route("/")
def serve_index():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/scanner")
def serve_scanner():
    return send_from_directory(BASE_DIR, "mobile_scanner.html")

@app.route("/printables")
def serve_printables():
    return send_from_directory(os.path.join(BASE_DIR, "printables"), "fichas_print.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(BASE_DIR, path)

@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify(get_current_system_state())

@app.route("/api/set_country", methods=["POST"])
def api_set_country():
    data = request.get_json(force=True)
    t_id = int(data.get("turbine", 1))
    country = data.get("country")
    target_turbine = turbine_1 if t_id == 1 else turbine_2

    if country:
        target_turbine.start_country_sequence(country)
        return jsonify({"status": "ok", "turbine": t_id, "country": country})
    else:
        target_turbine.stop()
        return jsonify({"status": "stopped", "turbine": t_id})

@app.route("/api/stop", methods=["POST"])
def api_stop():
    data = request.get_json(force=True) if request.data else {}
    t_id = data.get("turbine")
    if t_id == 1:
        turbine_1.stop()
    elif t_id == 2:
        turbine_2.stop()
    else:
        turbine_1.stop()
        turbine_2.stop()
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# DETECCIÓN DE PUERTOS SERIALES Y ARRANQUE
# ---------------------------------------------------------------------------

def detect_leonardo_ports():
    ports = list(serial.tools.list_ports.comports())
    leonardos = []
    for p in ports:
        desc = (p.description or "") + (p.manufacturer or "")
        # VID/PID habitual de Arduino Leonardo: 2341:8036 o "Leonardo"
        if "Leonardo" in desc or (p.vid == 0x2341 and p.pid == 0x8036):
            leonardos.append(p.device)
    return leonardos, [p.device for p in ports]

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Servidor Puente Físico - Turbinas Eólicas")
    parser.add_argument("--port1", type=str, default=None, help="Puerto COM para Turbina 1 (ej. COM3)")
    parser.add_argument("--port2", type=str, default=None, help="Puerto COM para Turbina 2 (ej. COM4)")
    parser.add_argument("--http-port", type=int, default=5000, help="Puerto HTTP (defecto 5000)")
    parser.add_argument("--ws-port", type=int, default=5001, help="Puerto WebSockets (defecto 5001)")
    args = parser.parse_args()

    leonardos, all_ports = detect_leonardo_ports()
    print("=================================================================")
    print("   PROYECTO FÍSICO INFOVIS: TURBINAS EÓLICAS COMPARATIVAS")
    print("=================================================================")
    print(f"Puertos COM detectados en el sistema: {all_ports}")

    # Asignación de puertos
    p1 = args.port1
    p2 = args.port2

    if not p1 and len(leonardos) >= 1:
        p1 = leonardos[0]
    if not p2 and len(leonardos) >= 2:
        p2 = leonardos[1]

    # Asignar a turbinas
    if p1:
        turbine_1.port_name = p1
        turbine_1.connect()
    else:
        print("[AVISO] Turbina 1 iniciando en modo SIMULACIÓN.")

    if p2:
        turbine_2.port_name = p2
        turbine_2.connect()
    else:
        print("[AVISO] Turbina 2 iniciando en modo SIMULACIÓN.")

    local_ip = get_local_ip()

    # Iniciar servidor WebSockets en hilo independiente
    ws_thread = threading.Thread(
        target=start_websocket_server,
        args=("0.0.0.0", args.ws_port),
        daemon=True
    )
    ws_thread.start()

    print("\n-----------------------------------------------------------------")
    print("📲 ACCESO DESDE EL CELULAR (Misma red WiFi):")
    print(f"   URL Escáner Móvil:  http://{local_ip}:{args.http_port}/scanner")
    print(f"   URL Fichas Imprimir: http://{local_ip}:{args.http_port}/printables")
    print(f"   Visualización PC:   http://localhost:{args.http_port}/")
    print("-----------------------------------------------------------------\n")

    # Iniciar servidor Flask
    app.run(host="0.0.0.0", port=args.http_port, debug=False, use_reloader=False)

