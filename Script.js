// ===== Settings =====
const API_URL = "http://127.0.0.1:8000/predict";
// Ring fill = score / SCORE_MAX. Change SCORE_MAX to match your model's real target scale.
const SCORE_MAX = 10;

// ===== Page elements =====
const form = document.getElementById("predictForm");
const btn = document.getElementById("predictBtn");
const btnText = document.getElementById("btnText");
const spinner = btn.querySelector(".spinner");
const resultSection = document.getElementById("resultSection");
const scoreValue = document.getElementById("scoreValue");
const ringFill = document.getElementById("ringFill");

// ===== Field rules: id = HTML id, key = FastAPI field name (must match the Pydantic model) =====
const fields = [
  { id: "age",            key: "age",                     type: "int",   min: 10, max: 100, label: "Age" },
  { id: "gender",         key: "gender",                  type: "text" },
  { id: "country",        key: "country",                 type: "text",  label: "Country" },
  { id: "academicLevel",  key: "academic_level",          type: "text" },
  { id: "platform",       key: "most_used_platform",      type: "text" },
  { id: "purpose",        key: "purpose_of_use",          type: "text" },
  { id: "avgUsage",       key: "avg_daily_usage_hours",   type: "float", min: 0, max: 24, label: "Average daily usage" },
  { id: "dailyUnlocks",   key: "daily_unlocks",           type: "int",   min: 0, label: "Daily unlocks" },
  { id: "studyHours",     key: "study_hours",             type: "float", min: 0, max: 24, label: "Study hours" },
  { id: "activityHours",  key: "physical_activity_hours", type: "float", min: 0, max: 24, label: "Physical activity" },
  { id: "sleepHours",     key: "sleep_hours_per_night",   type: "float", min: 0, max: 24, label: "Sleep hours" },
  { id: "stressLevel",    key: "stress_level",            type: "text" },
];

// ===== Toast notifications (reusable) =====
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = message;
  document.getElementById("toastBox").appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// ===== Validation: shows a message under the field and highlights it =====
function setError(id, message) {
  const el = document.getElementById(id);
  document.getElementById(id + "Error").textContent = message;
  el.parentElement.classList.toggle("invalid", Boolean(message));
  el.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateField(f) {
  const el = document.getElementById(f.id);
  const value = el.value.trim();
  if (value === "") { setError(f.id, "This field is required."); return false; }
  if (f.type !== "text") {
    const num = Number(value);
    if (Number.isNaN(num)) { setError(f.id, "Enter a valid number."); return false; }
    if (f.type === "int" && !Number.isInteger(num)) { setError(f.id, "Enter a whole number."); return false; }
    if (f.min !== undefined && num < f.min) { setError(f.id, `${f.label} must be at least ${f.min}.`); return false; }
    if (f.max !== undefined && num > f.max) { setError(f.id, `${f.label} must be at most ${f.max}.`); return false; }
  }
  setError(f.id, "");
  return true;
}

// Validate every field; focus the first invalid one
function validateForm() {
  let firstBad = null;
  fields.forEach(f => {
    if (!validateField(f) && !firstBad) firstBad = f.id;
  });
  if (firstBad) document.getElementById(firstBad).focus();
  return !firstBad;
}

// Clear an error as soon as the user edits that field
fields.forEach(f => document.getElementById(f.id).addEventListener("input", () => validateField(f)));

// ===== Build the JSON body (keys match the FastAPI studentData model) =====
function collectData() {
  const data = {};
  fields.forEach(f => {
    const value = document.getElementById(f.id).value.trim();
    data[f.key] = f.type === "text" ? value : Number(value);
  });
  return data;
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  spinner.hidden = !isLoading;
  btnText.textContent = isLoading ? "Analyzing Student Data..." : "Predict Mental Health Score";
}

// Count the number up and fill the ring
function showResult(score) {
  resultSection.hidden = false;
  const circumference = 339.3;
  ringFill.style.strokeDashoffset = circumference;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / 1200, 1);
    scoreValue.textContent = (score * p).toFixed(2);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const ratio = Math.max(0, Math.min(score / SCORE_MAX, 1));
  setTimeout(() => { ringFill.style.strokeDashoffset = circumference * (1 - ratio); }, 50);
  resultSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ===== Submit: call the FastAPI backend =====
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateForm()) { showToast("Please fix the highlighted fields.", "error"); return; }

  setLoading(true);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectData()),
    });
    if (!response.ok) {
      // FastAPI sends 422 for invalid input and 500 for server errors
      throw new Error(response.status === 422 ? "validation" : "server");
    }
    const result = await response.json();
    showResult(result.predicted_mental_health_score);  // real value from the backend
    showToast("Prediction generated successfully!", "success");
  } catch (error) {
    if (error instanceof TypeError) {   // fetch itself failed: server is not reachable
      showToast("Unable to connect to the prediction server. Please make sure FastAPI is running at http://127.0.0.1:8000.", "error");
    } else if (error.message === "validation") {
      showToast("The server rejected some values. Please check your inputs.", "error");
    } else {
      showToast("Something went wrong. Please try again.", "error");
    }
  } finally {
    setLoading(false);
  }
});

// ===== Buttons and navigation =====
document.getElementById("againBtn").addEventListener("click", () =>
  document.getElementById("predict").scrollIntoView({ behavior: "smooth" }));   // values stay

document.getElementById("clearBtn").addEventListener("click", () => {
  form.reset();
  fields.forEach(f => setError(f.id, ""));
  resultSection.hidden = true;
  document.getElementById("predict").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("startBtn").addEventListener("click", () =>
  document.getElementById("predict").scrollIntoView({ behavior: "smooth" }));

// Close the Bootstrap mobile menu after a link is clicked
document.querySelectorAll("#navMenu .nav-link").forEach(a => a.addEventListener("click", () => {
  const menu = bootstrap.Collapse.getInstance(document.getElementById("navMenu"));
  if (menu) menu.hide();
}));