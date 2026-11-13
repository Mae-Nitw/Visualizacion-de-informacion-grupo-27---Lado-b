/*
  =============================================================================
  TURBINES PHYSICAL SYNCHRONIZER (turbines_listener.js)
  Sincroniza la visualización web principal con las turbinas físicas de Arduino
  =============================================================================
*/

(function() {
  const wsUrl = `ws://${window.location.hostname || 'localhost'}:5001`;
  let ws = null;

  // Crear widget flotante para monitorear las 2 turbinas en pantalla grande
  function createTurbinesWidget() {
    const container = document.createElement("div");
    container.id = "physical-turbines-hud";
    container.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(8px);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 10px 14px;
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 0.8rem;
    `;

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:1.1rem;">💨</span>
        <div>
          <div style="font-weight:800; font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">Instalación Física</div>
          <div id="hud-ws-status" style="font-size:0.7rem; color:#f87171; font-weight:700;">Desconectado</div>
        </div>
      </div>
      <div style="height:26px; width:1px; background:#334155;"></div>
      <!-- Turbina 1 -->
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#38bdf8; font-size:0.7rem;">TURBINA 1</span>
        <span id="hud-t1-text" style="font-weight:700; font-size:0.82rem;">— Reposo —</span>
      </div>
      <div style="height:26px; width:1px; background:#334155;"></div>
      <!-- Turbina 2 -->
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#34d399; font-size:0.7rem;">TURBINA 2</span>
        <span id="hud-t2-text" style="font-weight:700; font-size:0.82rem;">— Reposo —</span>
      </div>
      <a href="/scanner" target="_blank" style="margin-left:6px; background:#2563eb; color:white; text-decoration:none; padding:5px 9px; border-radius:6px; font-weight:700; font-size:0.72rem;">Abrir Escáner 📱</a>
    `;

    document.body.appendChild(container);
  }

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        const s = document.getElementById("hud-ws-status");
        if (s) {
          s.style.color = "#34d399";
          s.textContent = "2 Arduinos en Línea";
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "STATE_UPDATE" && data.turbines) {
            const t1 = data.turbines["1"];
            const t2 = data.turbines["2"];

            const el1 = document.getElementById("hud-t1-text");
            const el2 = document.getElementById("hud-t2-text");

            if (el1 && t1) {
              el1.textContent = t1.country ? `${t1.country} (${t1.speed}%)` : "— Reposo —";
            }
            if (el2 && t2) {
              el2.textContent = t2.country ? `${t2.country} (${t2.speed}%)` : "— Reposo —";
            }

            // Opcional: si el mapa D3 tiene la función selectCountry global, enfocar el país
            if (t1 && t1.country && window.selectCountry && typeof window.selectCountry === "function") {
              // Solo enfocar si el usuario no tiene bloqueada la selección manual
            }
          }
        } catch(e) {}
      };

      ws.onclose = () => {
        const s = document.getElementById("hud-ws-status");
        if (s) {
          s.style.color = "#f87171";
          s.textContent = "Desconectado";
        }
        setTimeout(connect, 2500);
      };

      ws.onerror = () => ws.close();
    } catch(e) {
      setTimeout(connect, 2500);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    createTurbinesWidget();
    connect();
  });
})();

