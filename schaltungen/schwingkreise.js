const elements = {
  tabs: document.querySelectorAll(".mode-switch button"),
  resistance: document.getElementById("resistance"),
  inductance: document.getElementById("inductance"),
  capacitance: document.getElementById("capacitance"),
  frequency: document.getElementById("frequency"),
  resistanceOutput: document.getElementById("resistanceOutput"),
  inductanceOutput: document.getElementById("inductanceOutput"),
  capacitanceOutput: document.getElementById("capacitanceOutput"),
  frequencyOutput: document.getElementById("frequencyOutput"),
  inductanceGroup: document.getElementById("inductanceGroup"),
  capacitanceGroup: document.getElementById("capacitanceGroup"),
  inductorGroup: document.getElementById("inductorGroup"),
  capacitorGroup: document.getElementById("capacitorGroup"),
  schematicTitle: document.getElementById("schematicTitle"),
  schematicSvgTitle: document.getElementById("schematicSvgTitle"),
  schematicSvgDesc: document.getElementById("schematicSvgDesc"),
  rSchematicValue: document.getElementById("rSchematicValue"),
  reactiveSchematicValue: document.getElementById("reactiveSchematicValue"),
  formulaMain: document.getElementById("formulaMain"),
  formulaPhase: document.getElementById("formulaPhase"),
  impedanceValue: document.getElementById("impedanceValue"),
  currentValue: document.getElementById("currentValue"),
  phaseValue: document.getElementById("phaseValue"),
  explanation: document.getElementById("explanation"),
  pauseButton: document.getElementById("pauseButton"),
  resetButton: document.getElementById("resetButton"),
  scope: document.getElementById("scope")
};

const defaults = { resistance: 100, inductance: 100, capacitance: 10, frequency: 100 };
let mode = "rl";
let running = true;
let animationPhase = 0;
let previousTime = performance.now();
let circuit = {};

const german = (value, digits = 1) => value.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const compactOhms = value => value >= 1000 ? `${german(value / 1000, 2)} kΩ` : `${german(value, 1)} Ω`;

function calculate() {
  const R = Number(elements.resistance.value);
  const L = Number(elements.inductance.value) / 1000;
  const C = Number(elements.capacitance.value) / 1e6;
  const f = Number(elements.frequency.value);
  const omega = 2 * Math.PI * f;
  const reactance = mode === "rl" ? omega * L : -1 / (omega * C);
  const impedance = Math.hypot(R, reactance);
  const phase = Math.atan2(reactance, R);
  const current = 10 / impedance;
  circuit = { R, L, C, f, reactance, impedance, phase, current };
}

function updateInterface() {
  calculate();
  const { R, L, C, f, impedance, phase, current } = circuit;
  elements.resistanceOutput.value = `${german(R, 0)} Ω`;
  elements.inductanceOutput.value = `${german(L * 1000, 0)} mH`;
  elements.capacitanceOutput.value = `${german(C * 1e6, 0)} µF`;
  elements.frequencyOutput.value = `${german(f, 0)} Hz`;
  elements.rSchematicValue.textContent = `R = ${german(R, 0)} Ω`;
  elements.reactiveSchematicValue.textContent = mode === "rl" ? `L = ${german(L * 1000, 0)} mH` : `C = ${german(C * 1e6, 0)} µF`;
  elements.impedanceValue.textContent = compactOhms(impedance);
  elements.currentValue.textContent = current < 1 ? `${german(current * 1000, 1)} mA` : `${german(current, 2)} A`;
  elements.phaseValue.textContent = `${phase >= 0 ? "+" : "−"}${german(Math.abs(phase * 180 / Math.PI), 1)}°`;

  [elements.resistance, elements.inductance, elements.capacitance, elements.frequency].forEach(input => {
    const fill = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    input.style.background = `linear-gradient(to right, #0b72c9 0 ${fill}%, #d2dbe3 ${fill}% 100%)`;
  });
}

function setMode(nextMode) {
  mode = nextMode;
  const isRL = mode === "rl";
  elements.tabs.forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  elements.inductorGroup.classList.toggle("is-hidden", !isRL);
  elements.capacitorGroup.classList.toggle("is-hidden", isRL);
  elements.inductorGroup.style.display = isRL ? "" : "none";
  elements.capacitorGroup.style.display = isRL ? "none" : "";
  elements.inductance.disabled = !isRL;
  elements.capacitance.disabled = isRL;
  elements.inductanceGroup.classList.toggle("inactive-control", !isRL);
  elements.inductanceGroup.classList.toggle("active-control", isRL);
  elements.capacitanceGroup.classList.toggle("inactive-control", isRL);
  elements.capacitanceGroup.classList.toggle("active-control", !isRL);
  elements.inductanceGroup.querySelector(".inactive-note")?.remove();
  elements.capacitanceGroup.querySelector(".inactive-note")?.remove();
  const inactiveGroup = isRL ? elements.capacitanceGroup : elements.inductanceGroup;
  const note = document.createElement("small");
  note.className = "inactive-note";
  note.textContent = `Im ${isRL ? "RL" : "RC"}-Kreis nicht wirksam`;
  inactiveGroup.appendChild(note);
  elements.schematicTitle.textContent = `${isRL ? "RL" : "RC"}-Reihenschaltung`;
  elements.schematicSvgTitle.textContent = `Schaltplan einer ${isRL ? "RL" : "RC"}-Reihenschaltung`;
  elements.schematicSvgDesc.textContent = `Eine Wechselspannungsquelle, ein Widerstand und ${isRL ? "eine Spule" : "ein Kondensator"} in Reihe.`;
  elements.formulaMain.innerHTML = isRL
    ? "X<sub>L</sub> = 2 · π · f · L"
    : "X<sub>C</sub> = 1 / (2 · π · f · C)";
  elements.formulaPhase.innerHTML = isRL
    ? "Z = √(R² + X<sub>L</sub>²)"
    : "Z = √(R² + X<sub>C</sub>²)";
  elements.explanation.innerHTML = isRL
    ? '<div class="explanation-icon">L</div><div><strong>Induktives Verhalten</strong><p>Der Strom eilt der Spannung nach. Mit steigender Frequenz wächst der induktive Widerstand.</p></div>'
    : '<div class="explanation-icon" style="background:#f08a24">C</div><div><strong>Kapazitives Verhalten</strong><p>Der Strom eilt der Spannung voraus. Mit steigender Frequenz sinkt der kapazitive Widerstand.</p></div>';
  updateInterface();
}

function drawScope(timestamp) {
  const canvas = elements.scope;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, Math.round(rect.width * ratio));
  const height = Math.max(220, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d");
  if (running) animationPhase += Math.min((timestamp - previousTime) / 1000, .05) * 1.5;
  previousTime = timestamp;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#102331";
  ctx.fillRect(0, 0, width, height);

  const pad = 28 * ratio;
  ctx.lineWidth = ratio;
  ctx.strokeStyle = "rgba(132,177,205,.12)";
  for (let x = pad; x <= width - pad; x += (width - 2 * pad) / 8) { ctx.beginPath(); ctx.moveTo(x,pad); ctx.lineTo(x,height-pad); ctx.stroke(); }
  for (let y = pad; y <= height - pad; y += (height - 2 * pad) / 6) { ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(width-pad,y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(184,213,230,.35)";
  ctx.beginPath(); ctx.moveTo(pad,height/2); ctx.lineTo(width-pad,height/2); ctx.stroke();

  const cycles = 2.25;
  const amplitude = (height - 2 * pad) * .35;
  function wave(color, phaseOffset) {
    ctx.beginPath();
    for (let x = pad; x <= width - pad; x += ratio) {
      const normalized = (x - pad) / (width - 2 * pad);
      const angle = normalized * Math.PI * 2 * cycles + animationPhase + phaseOffset;
      const y = height / 2 - Math.sin(angle) * amplitude;
      if (x === pad) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.3 * ratio;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4 * ratio;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  wave("#55b8ff", 0);
  wave("#f6a148", -circuit.phase);
  ctx.fillStyle = "rgba(200,225,238,.58)";
  ctx.font = `${9 * ratio}px Arial`;
  ctx.fillText("+", 10 * ratio, height / 2 - amplitude + 3 * ratio);
  ctx.fillText("0", 9 * ratio, height / 2 + 3 * ratio);
  ctx.fillText("−", 10 * ratio, height / 2 + amplitude + 3 * ratio);
  requestAnimationFrame(drawScope);
}

elements.tabs.forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
[elements.resistance, elements.inductance, elements.capacitance, elements.frequency].forEach(input => input.addEventListener("input", updateInterface));
elements.pauseButton.addEventListener("click", () => {
  running = !running;
  elements.pauseButton.textContent = running ? "Ⅱ" : "▶";
  elements.pauseButton.setAttribute("aria-label", running ? "Animation pausieren" : "Animation fortsetzen");
});
elements.resetButton.addEventListener("click", () => {
  Object.entries(defaults).forEach(([key,value]) => { elements[key].value = value; });
  animationPhase = 0;
  setMode("rl");
});

calculate();
requestAnimationFrame(drawScope);
setMode("rl");
