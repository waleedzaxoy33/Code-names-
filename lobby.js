const socket = io();

let currentLang = localStorage.getItem("codenames_lang") || "ar";
applyI18n(currentLang);
document.querySelectorAll(".lang-btn").forEach((btn) => {
  if (btn.dataset.lang === currentLang) btn.classList.add("active");
  else btn.classList.remove("active");
  btn.addEventListener("click", () => {
    currentLang = btn.dataset.lang;
    localStorage.setItem("codenames_lang", currentLang);
    document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b === btn));
    applyI18n(currentLang);
  });
});

const nameInput = document.getElementById("nameInput");
const codeInput = document.getElementById("codeInput");
const errorMsg = document.getElementById("errorMsg");

const savedName = localStorage.getItem("codenames_name");
if (savedName) nameInput.value = savedName;

function showError(key) {
  errorMsg.textContent = t(currentLang, key);
}

document.getElementById("createBtn").addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) return showError("err_nameRequired");
  localStorage.setItem("codenames_name", name);
  socket.emit("createRoom", { name, language: currentLang });
});

document.getElementById("joinBtn").addEventListener("click", () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();
  if (!name) return showError("err_nameRequired");
  if (!code) return showError("err_codeRequired");
  localStorage.setItem("codenames_name", name);
  socket.emit("joinRoom", { name, code });
});

codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.toUpperCase();
});

socket.on("roomState", (state) => {
  // Persist session so the game page can pick it up after navigation
  sessionStorage.setItem("codenames_room", state.code);
  sessionStorage.setItem("codenames_lang", state.language);
  window.location.href = `/game.html?room=${state.code}`;
});

socket.on("errorMsg", ({ key }) => {
  showError(key);
});
