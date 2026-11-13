/*
  =============================================================================
  CONTROLADOR PROTOBJECT Y WEBSERIAL PARA TURBINAS EÓLICAS FÍSICAS (GRUPO 27)
  =============================================================================
*/

(function() {
  // Estado de las dos turbinas
  const turbines = {
    1: {
      port: null,
      writer: null,
      isConnected: false,
      country: null,
      currentYear: null,
      currentShare: 0,
      currentSpeed: 0,
      timerId: null,
      status: "idle"
    },
    2: {
      port: null,
      writer: null,
      isConnected: false,
      country: null,
      currentYear: null,
      currentShare: 0,
      currentSpeed: 0,
      timerId: null,
      status: "idle"
    }
  };

  // Base de datos energética cargada en memoria
  let energyData = null;

  async function loadEnergyData() {
    if (window.energyData) {
      energyData = window.energyData;
      return;
    }
    try {
      const res = await fetch("energy_data.json");
      energyData = await res.json();
    } catch(e) {
      console.warn("No se pudo cargar energy_data.json:", e);
    }
  }

  // ---------------------------------------------------------------------------
  // WEBSERIAL API: Conexión directa desde Chrome a los 2 Arduinos Leonardo
  // ---------------------------------------------------------------------------
  async function connectArduino(turbineId) {
    if (!("serial" in navigator)) {
      alert("Tu navegador no soporta Web Serial API. Usa Google Chrome o Microsoft Edge.");
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();

      turbines[turbineId].port = port;
      turbines[turbineId].writer = writer;
      turbines[turbineId].isConnected = true;

      // Enviar comando inicial
      await sendSerial(turbineId, "STOP");

      updateHUD();
      alert(`¡Arduino Leonardo para Turbina ${turbineId} (Pin 5) conectado con éxito!`);
    } catch(err) {
      console.error(`Error conectando Turbina ${turbineId}:`, err);
    }
  }

  async function sendSerial(turbineId, cmd) {
    const t = turbines[turbineId];
    if (t.writer && t.isConnected) {
      try {
        await t.writer.write(`${cmd}\n`);
      } catch(e) {
        console.error(`Error enviando comando a Turbina ${turbineId}:`, e);
      }
    }
  }

  function setTurbineSpeed(turbineId, percent) {
    percent = Math.max(0, Math.min(100, percent));
    turbines[turbineId].currentSpeed = percent;
    sendSerial(turbineId, `SPEED:${percent.toFixed(1)}`);
    updateHUD();
  }

  function stopTurbine(turbineId) {
    const t = turbines[turbineId];
    if (t.timerId) {
      clearInterval(t.timerId);
      t.timerId = null;
    }
    t.country = null;
    t.currentYear = null;
    t.currentShare = 0;
    t.currentSpeed = 0;
    t.status = "idle";
    sendSerial(turbineId, "STOP");
    updateHUD();
  }

  // ---------------------------------------------------------------------------
  // MOTOR TEMPORAL: 2000 AL ÚLTIMO AÑO (ANIMACIÓN FÍSICA AÑO A AÑO)
  // ---------------------------------------------------------------------------
  function startTurbineTimeline(turbineId, countryName) {
    if (!energyData || !energyData[countryName]) {
      console.warn(`País ${countryName} no encontrado.`);
      return;
    }

    const t = turbines[turbineId];
    if (t.timerId) {
      clearInterval(t.timerId);
      t.timerId = null;
    }

    t.country = countryName;
    t.status = "animating";

    const cInfo = energyData[countryName];
    const years = cInfo.years || [];
    const windShares = (cInfo.sources && cInfo.sources.Wind && cInfo.sources.Wind.share) ? cInfo.sources.Wind.share : [];

    if (!years.length || !windShares.length) {
      stopTurbine(turbineId);
      return;
    }

    let index = 0;
    const totalSteps = years.length;

    // Ejecutar inmediatamente el primer año
    runStep();

    // Intervalo de ~350ms por año (~8.7 segundos en total)
    t.timerId = setInterval(() => {
      index++;
      if (index < totalSteps) {
        runStep();
      } else {
        // Fin de la animación: mantener el régimen del último año indefinidamente
        clearInterval(t.timerId);
        t.timerId = null;
        t.status = "holding";
        updateHUD();
      }
    }, 350);

    function runStep() {
      const year = years[index];
      const share = windShares[index] !== undefined ? windShares[index] : windShares[windShares.length - 1];

      // Mapeo: 35% de viento = 100% velocidad del servo
      const MAX_SHARE_REF = 35.0;
      const speed = Math.max(0, Math.min(100, (share / MAX_SHARE_REF) * 100));

      t.currentYear = year;
      t.currentShare = share;
      setTurbineSpeed(turbineId, speed);

      // Notificar al celular vía Protobject para mantener la pantalla sincronizada
      try {
        if (window.Protobject && window.Protobject.Core) {
          Protobject.Core.send({
            type: "SYNC",
            turbine: turbineId,
            year: year,
            share: share.toFixed(1),
            speed: speed.toFixed(1)
          }).to("scanner.html");
        }
      } catch(e) {}
    }
  }

  // ---------------------------------------------------------------------------
  // RECEPCIÓN PROTOBJECT DESDE EL CELULAR
  // ---------------------------------------------------------------------------
  function initProtobjectListener() {
    try {
      if (window.Protobject && window.Protobject.Core) {
        Protobject.Core.onReceived(function(data) {
          if (!data || !data.turbine) return;
          const tId = parseInt(data.turbine, 10);

          if (data.action === "remove") {
            stopTurbine(tId);
          } else if (data.action === "set_country" && data.country) {
            startTurbineTimeline(tId, data.country);

            // Opcional: si existe la función selectCountry en main.js, enfocar el mapa
            if (typeof window.selectCountry === "function") {
              window.selectCountry(data.country);
            }
          }
        });
      }
    } catch(err) {
      console.warn("Protobject listener error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // PANEL FLOTANTE EN PANTALLA PRINCIPAL (HUD Y CONEXIONES)
  // ---------------------------------------------------------------------------
  function createFloatingUI() {
    const box = document.createElement("div");
    box.id = "proto-turbines-bar";
    box.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(10px);
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 12px 16px;
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 310px;
    `;

    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:1.1rem;">💨</span>
          <strong style="font-size:0.85rem;">Turbinas Físicas Protobject</strong>
        </div>
        <a href="scanner.html" target="_blank" style="background:#0284c7; color:white; text-decoration:none; padding:3px 8px; border-radius:6px; font-size:0.7rem; font-weight:bold;">📱 Escáner</a>
      </div>

      <!-- Turbina 1 -->
      <div style="background:#1e293b; padding:8px 10px; border-radius:8px; border-left:3px solid #0ea5e9; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.7rem; color:#38bdf8; font-weight:800;">TURBINA 1 (Pin 5)</div>
          <div id="ui-t1-info" style="font-size:0.8rem; font-weight:700;">— Reposo —</div>
        </div>
        <button id="btn-conn-t1" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">🔌 Conectar USB</button>
      </div>

      <!-- Turbina 2 -->
      <div style="background:#1e293b; padding:8px 10px; border-radius:8px; border-left:3px solid #10b981; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.7rem; color:#34d399; font-weight:800;">TURBINA 2 (Pin 5)</div>
          <div id="ui-t2-info" style="font-size:0.8rem; font-weight:700;">— Reposo —</div>
        </div>
        <button id="btn-conn-t2" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">🔌 Conectar USB</button>
      </div>
    `;

    document.body.appendChild(box);

    document.getElementById("btn-conn-t1").onclick = () => connectArduino(1);
    document.getElementById("btn-conn-t2").onclick = () => connectArduino(2);
  }

  function updateHUD() {
    const el1 = document.getElementById("ui-t1-info");
    const el2 = document.getElementById("ui-t2-info");
    const btn1 = document.getElementById("btn-conn-t1");
    const btn2 = document.getElementById("btn-conn-t2");

    if (el1) {
      const t1 = turbines[1];
      el1.textContent = t1.country ? `${t1.country} (${t1.currentYear || 2000}) • ${t1.currentSpeed.toFixed(0)}% vel` : "— Reposo —";
      if (btn1 && t1.isConnected) {
        btn1.textContent = "✓ Conectado";
        btn1.style.background = "rgba(14,165,233,0.2)";
        btn1.style.borderColor = "#0ea5e9";
        btn1.style.color = "#38bdf8";
      }
    }

    if (el2) {
      const t2 = turbines[2];
      el2.textContent = t2.country ? `${t2.country} (${t2.currentYear || 2000}) • ${t2.currentSpeed.toFixed(0)}% vel` : "— Reposo —";
      if (btn2 && t2.isConnected) {
        btn2.textContent = "✓ Conectado";
        btn2.style.background = "rgba(16,185,129,0.2)";
        btn2.style.borderColor = "#10b981";
        btn2.style.color = "#34d399";
      }
    }
  }

  // Inicialización
  window.addEventListener("DOMContentLoaded", async () => {
    await loadEnergyData();
    createFloatingUI();
    initProtobjectListener();
  });
})();

