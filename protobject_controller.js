/*
  =============================================================================
  CONTROLADOR DE ROTORES ARDUINO LEONARDO (PIN 5) Y PROTOBJECT - GRUPO 27
  Envío estándar de Servo: 90 = Parado, 95 a 180 = Giro hacia adelante
  =============================================================================
*/

(function() {
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
  // ENVÍO ESTÁNDAR POR WEBSERIAL A ARDUINO
  // BaudRate estándar: 9600
  // Valores: 90 = Parado, 95 a 180 = Giro
  // ---------------------------------------------------------------------------
  async function connectArduino(turbineId) {
    if (!("serial" in navigator)) {
      alert("Para conectar los Arduinos por USB, abre esta página en Google Chrome o Microsoft Edge.");
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 }); // Baudrate estándar de Arduino

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();

      turbines[turbineId].port = port;
      turbines[turbineId].writer = writer;
      turbines[turbineId].isConnected = true;

      // Parada inicial: 90
      await sendAngle(turbineId, 90);

      updateHUD();
      alert(`¡Arduino para Turbina ${turbineId} (Pin 5) conectado! Pulsa '⚡ Test 2s' para verificar que gira.`);
    } catch(err) {
      console.error(`Error conectando Turbina ${turbineId}:`, err);
    }
  }

  async function sendAngle(turbineId, angle) {
    const t = turbines[turbineId];
    if (t.writer && t.isConnected) {
      try {
        await t.writer.write(`${angle}\n`);
      } catch(e) {
        console.warn(`Error enviando serial a Turbina ${turbineId}:`, e);
      }
    }
  }

  function setTurbineSpeed(turbineId, percent) {
    percent = Math.max(0, Math.min(100, percent));
    turbines[turbineId].currentSpeed = percent;

    // Mapeo estándar de servo continuo:
    // 0% -> 90 (detenido)
    // 1% a 100% -> 95 a 180 (giro hacia adelante)
    const angle = percent <= 0.5 ? 90 : Math.round(96 + (percent / 100) * 84);
    sendAngle(turbineId, angle);

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

    // Detener servo con 90
    sendAngle(turbineId, 90);

    const logEl = document.getElementById("proto-log-msg");
    if (logEl) logEl.textContent = `Turbina ${turbineId} detenida.`;
    updateHUD();
  }

  // Prueba rápida de 2 segundos al 50% de velocidad
  function testTurbine(turbineId) {
    const logEl = document.getElementById("proto-log-msg");
    if (logEl) logEl.textContent = `Probando giro de Turbina ${turbineId}...`;

    // 140 = velocidad media hacia adelante
    sendAngle(turbineId, 140);
    turbines[turbineId].currentSpeed = 50;
    updateHUD();

    setTimeout(() => {
      sendAngle(turbineId, 90);
      turbines[turbineId].currentSpeed = 0;
      updateHUD();
      if (logEl) logEl.textContent = `Prueba de Turbina ${turbineId} finalizada.`;
    }, 2000);
  }

  // ---------------------------------------------------------------------------
  // MOTOR TEMPORAL: RECORRE DE 2000 A 2025 Y SE QUEDA GIRANDO FIJO EN 2025
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

    const logEl = document.getElementById("proto-log-msg");
    if (logEl) logEl.textContent = `¡Ficha en ${countryName}! Acelerando Turbina ${turbineId} (2000 → 2025)...`;

    let index = 0;
    const totalSteps = years.length;

    runStep();

    t.timerId = setInterval(() => {
      index++;
      if (index < totalSteps) {
        runStep();
      } else {
        clearInterval(t.timerId);
        t.timerId = null;
        t.status = "holding";
        if (logEl) logEl.textContent = `${countryName} (2025): Manteniendo régimen fijo a ${t.currentSpeed.toFixed(0)}% vel.`;
        updateHUD();
      }
    }, 350);

    function runStep() {
      const year = years[index];
      const share = windShares[index] !== undefined ? windShares[index] : windShares[windShares.length - 1];

      // Mapeo: 35% de energía eólica = 100% velocidad
      const MAX_SHARE_REF = 35.0;
      const speed = Math.max(0, Math.min(100, (share / MAX_SHARE_REF) * 100));

      t.currentYear = year;
      t.currentShare = share;
      setTurbineSpeed(turbineId, speed);

      // Notificar al celular para mostrar el año sincronizado
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
  // RECEPCIÓN DE PROTOBJECT DESDE EL CELULAR
  // ---------------------------------------------------------------------------
  function initProtobjectListener() {
    try {
      if (window.Protobject && window.Protobject.Core) {
        Protobject.Core.onReceived(function(data) {
          console.log("[PROTOBJECT RECIBIDO]:", data);
          if (!data || !data.turbine) return;
          const tId = parseInt(data.turbine, 10);

          if (data.action === "remove") {
            stopTurbine(tId);
          } else if (data.action === "set_country" && data.country) {
            startTurbineTimeline(tId, data.country);

            if (typeof window.selectCountry === "function") {
              window.selectCountry(data.country);
            }
          }
        });
      }
    } catch(err) {
      console.warn("Error en Protobject onReceived:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // PANEL FLOTANTE EN PANTALLA PRINCIPAL
  // ---------------------------------------------------------------------------
  function createFloatingUI() {
    const box = document.createElement("div");
    box.id = "proto-turbines-bar";
    box.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(12px);
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 14px 18px;
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      box-shadow: 0 10px 35px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 340px;
    `;

    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.2rem;">💨</span>
          <div>
            <div style="font-weight:800; font-size:0.85rem;">Turbinas Físicas (Pin 5)</div>
            <div id="proto-log-msg" style="font-size:0.68rem; color:#f59e0b; font-weight:700;">Esperando fichas del celular...</div>
          </div>
        </div>
        <a href="scanner.html" target="_blank" style="background:#0284c7; color:white; text-decoration:none; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:bold;">📱 Escáner</a>
      </div>

      <!-- Turbina 1 -->
      <div style="background:#1e293b; padding:10px 12px; border-radius:10px; border-left:4px solid #ef4444; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div id="rotor-icon-t1" style="width:26px; height:26px; display:inline-block; transform-origin:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2">
              <circle cx="12" cy="12" r="3" fill="#ef4444"/>
              <path d="M12 9V2M12 15v7M15 12h7M9 12H2M14.1 9.9l4.95-4.95M9.9 14.1l-4.95 4.95"/>
            </svg>
          </div>
          <div>
            <div style="font-size:0.7rem; color:#f87171; font-weight:800;">TURBINA 1 (Ficha 1 Roja)</div>
            <div id="ui-t1-info" style="font-size:0.82rem; font-weight:700;">— Reposo —</div>
          </div>
        </div>
        <div style="display:flex; gap:4px;">
          <button id="btn-test-t1" style="background:#334155; border:none; color:white; padding:5px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;" title="Probar giro de 2 segundos">⚡ Test 2s</button>
          <button id="btn-conn-t1" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; padding:5px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">🔌 USB</button>
        </div>
      </div>

      <!-- Turbina 2 -->
      <div style="background:#1e293b; padding:10px 12px; border-radius:10px; border-left:4px solid #22c55e; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div id="rotor-icon-t2" style="width:26px; height:26px; display:inline-block; transform-origin:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.2">
              <circle cx="12" cy="12" r="3" fill="#22c55e"/>
              <path d="M12 9V2M12 15v7M15 12h7M9 12H2M14.1 9.9l4.95-4.95M9.9 14.1l-4.95 4.95"/>
            </svg>
          </div>
          <div>
            <div style="font-size:0.7rem; color:#4ade80; font-weight:800;">TURBINA 2 (Ficha 2 Verde)</div>
            <div id="ui-t2-info" style="font-size:0.82rem; font-weight:700;">— Reposo —</div>
          </div>
        </div>
        <div style="display:flex; gap:4px;">
          <button id="btn-test-t2" style="background:#334155; border:none; color:white; padding:5px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;" title="Probar giro de 2 segundos">⚡ Test 2s</button>
          <button id="btn-conn-t2" style="background:#0f172a; border:1px solid #334155; color:#cbd5e1; padding:5px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">🔌 USB</button>
        </div>
      </div>
    `;

    document.body.appendChild(box);

    document.getElementById("btn-conn-t1").onclick = () => connectArduino(1);
    document.getElementById("btn-conn-t2").onclick = () => connectArduino(2);
    document.getElementById("btn-test-t1").onclick = () => testTurbine(1);
    document.getElementById("btn-test-t2").onclick = () => testTurbine(2);

    // Animación visual continua de aspas en pantalla
    let angle1 = 0, angle2 = 0;
    function animateBlades() {
      if (turbines[1].currentSpeed > 0) {
        angle1 = (angle1 + (turbines[1].currentSpeed * 0.28)) % 360;
        const icon1 = document.getElementById("rotor-icon-t1");
        if (icon1) icon1.style.transform = `rotate(${angle1}deg)`;
      }
      if (turbines[2].currentSpeed > 0) {
        angle2 = (angle2 + (turbines[2].currentSpeed * 0.28)) % 360;
        const icon2 = document.getElementById("rotor-icon-t2");
        if (icon2) icon2.style.transform = `rotate(${angle2}deg)`;
      }
      requestAnimationFrame(animateBlades);
    }
    animateBlades();
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
        btn1.textContent = "✓ USB";
        btn1.style.background = "rgba(239, 68, 68, 0.25)";
        btn1.style.borderColor = "#ef4444";
        btn1.style.color = "#f87171";
      }
    }

    if (el2) {
      const t2 = turbines[2];
      el2.textContent = t2.country ? `${t2.country} (${t2.currentYear || 2000}) • ${t2.currentSpeed.toFixed(0)}% vel` : "— Reposo —";
      if (btn2 && t2.isConnected) {
        btn2.textContent = "✓ USB";
        btn2.style.background = "rgba(34, 197, 94, 0.25)";
        btn2.style.borderColor = "#22c55e";
        btn2.style.color = "#4ade80";
      }
    }
  }

  window.addEventListener("DOMContentLoaded", async () => {
    await loadEnergyData();
    createFloatingUI();
    initProtobjectListener();
  });
})();
