(() => {
  "use strict";

  // Backend address (no trailing slash). The /predict path is added below.
  const API_BASE = "https://mental-health-score-23ip.onrender.com";
  const ARC = 314;

  const $ = (id) => document.getElementById(id);
  const form = $("predict-form");
  const submitBtn = $("submit-btn");
  const spinner = submitBtn.querySelector(".spinner-border");
  const btnLabel = submitBtn.querySelector(".btn-label");
  const states = { idle: $("state-idle"), loading: $("state-loading"), result: $("state-result"), error: $("state-error") };
  const gaugeFill = $("gauge-fill");
  const scoreNumber = $("score-number");
  const stressInput = $("stress_level");
  const stressGroup = $("stress_level_group");

  // [id, type, min, max, label]
  const numeric = [
    ["age", "int", 10, 100, "Age"],
    ["avg_daily_usage_hours", "float", 0, 24, "Screen time"],
    ["daily_unlocks", "int", 0, Infinity, "Unlocks"],
    ["study_hours", "float", 0, 24, "Study hours"],
    ["physical_activity_hours", "float", 0, 24, "Exercise hours"],
    ["sleep_hours_per_night", "float", 0, 24, "Sleep hours"],
  ];
  const text = ["gender", "country", "academic_level", "most_used_platform", "purpose_of_use"];

  function setError(el, msg) {
    const field = el.closest(".field");
    field.classList.toggle("field-error", Boolean(msg));
    field.querySelector(".error-msg").textContent = msg || "";
  }

  stressGroup.querySelectorAll(".btn").forEach((b) => b.addEventListener("click", () => {
    stressGroup.querySelectorAll(".btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    stressInput.value = b.dataset.value;
    setError(stressInput, "");
  }));

  form.querySelectorAll("input, select").forEach((el) => {
    ["input", "change"].forEach((ev) => el.addEventListener(ev, () => setError(el, "")));
  });

  function collect() {
    const data = {};
    text.forEach((k) => (data[k] = $(k).value.trim()));
    numeric.forEach(([k, type]) => {
      const v = $(k).value.trim();
      data[k] = v === "" ? NaN : type === "int" ? parseInt(v, 10) : parseFloat(v);
    });
    data.stress_level = stressInput.value;
    return data;
  }

  function validate(data) {
    const bad = [];
    text.forEach((k) => { if (!data[k]) bad.push([$(k), "Please choose or enter a value."]); });
    numeric.forEach(([k, type, min, max, label]) => {
      const v = data[k];
      if (Number.isNaN(v)) bad.push([$(k), "This field is required."]);
      else if (type === "int" && !Number.isInteger(v)) bad.push([$(k), "Enter a whole number."]);
      else if (v < min || v > max) bad.push([$(k), max === Infinity ? `${label} must be ${min} or more.` : `${label} must be between ${min} and ${max}.`]);
    });
    if (!data.stress_level) bad.push([stressInput, "Select a stress level."]);
    return bad;
  }

  function show(name) {
    Object.entries(states).forEach(([k, el]) => (el.hidden = k !== name));
  }

  function setGauge(score) {
    gaugeFill.style.strokeDashoffset = String(ARC * (1 - Math.max(0, Math.min(10, score)) / 10));
  }

  function resetGauge() {
    gaugeFill.style.strokeDashoffset = String(ARC);
    scoreNumber.textContent = "--";
  }

  function band(score) {
    if (score < 4) return ["Under strain", "Your habits point to high strain. Small changes in sleep or screen time can help."];
    if (score < 7) return ["Fairly balanced", "Your routine looks steady, with room to recover and improve."];
    return ["Doing well", "Your habits point to a strong, resilient baseline. Keep it up."];
  }

  function showResult(score) {
    const [title, copy] = band(score);
    $("score-band").textContent = title;
    $("score-context").textContent = copy;
    scoreNumber.textContent = score.toFixed(2);
    show("result");
    requestAnimationFrame(() => setGauge(score));
  }

  function showError(title, copy) {
    $("error-label").textContent = title;
    $("error-copy").textContent = copy;
    resetGauge();
    show("error");
  }

  function loading(on) {
    submitBtn.disabled = on;
    spinner.hidden = !on;
    btnLabel.textContent = on ? "Analyzing..." : "Get my score";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    const data = collect();
    const bad = validate(data);
    if (bad.length) {
      bad.forEach(([el, msg]) => setError(el, msg));
      bad[0][0].focus?.();
      return;
    }

    loading(true);
    resetGauge();
    show("loading");
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 422) {
        showError("Check your answers", "The server could not accept one or more values. Review the form and try again.");
        return;
      }
      if (!res.ok) {
        showError("Prediction failed", `The server returned status ${res.status}. Please try again in a moment.`);
        return;
      }
      const body = await res.json();
      const score = Number(body.predicted_mental_health_score);
      if (Number.isNaN(score)) {
        showError("Unexpected response", "The server replied, but the score was missing.");
        return;
      }
      showResult(score);
    } catch (err) {
      console.error(err);
      showError("Cannot reach the server", "The backend may be waking up or blocked by CORS. Wait a minute and try again.");
    } finally {
      loading(false);
    }
  });

  $("reset-btn").addEventListener("click", () => { resetGauge(); show("idle"); });
  $("error-retry-btn").addEventListener("click", () => { resetGauge(); show("idle"); });
})();