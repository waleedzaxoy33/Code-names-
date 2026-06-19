const socket = io();

let currentLang = sessionStorage.getItem("codenames_lang") || localStorage.getItem("codenames_lang") || "ar";
let latestState = null;

const params = new URLSearchParams(window.location.search);
const roomFromUrl = params.get("room");
const savedName = localStorage.getItem("codenames_name");

// --- DOM refs ---
const roomCodeLabel = document.getElementById("roomCodeLabel");
const scorePill = document.getElementById("scorePill");
const teamPicker = document.getElementById("teamPicker");
const gameArea = document.getElementById("gameArea");
const controlsDock = document.getElementById("controlsDock");
const turnBanner = document.getElementById("turnBanner");
const clueBar = document.getElementById("clueBar");
const boardEl = document.getElementById("board");
const playerListEl = document.getElementById("playerList");
const startBtn = document.getElementById("startBtn");
const clueForm = document.getElementById("clueForm");
const clueWordInput = document.getElementById("clueWordInput");
const clueNumberInput = document.getElementById("clueNumberInput");
const endTurnBtn = document.getElementById("endTurnBtn");
const statusLine = document.getElementById("statusLine");
const endOverlay = document.getElementById("endOverlay");
const winnerText = document.getElementById("winnerText");

// --- Language toggle ---
function setLangButtons() {
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === currentLang);
  });
}
applyI18n(currentLang);
setLangButtons();
document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentLang = btn.dataset.lang;
    localStorage.setItem("codenames_lang", currentLang);
    applyI18n(currentLang);
    setLangButtons();
    if (latestState) render(latestState);
  });
});

// --- Rejoin room on page load (page navigation drops the old socket) ---
if (roomFromUrl && savedName) {
  socket.emit("joinRoom", { name: savedName, code: roomFromUrl });
} else {
  window.location.href = "/";
}

socket.on("errorMsg", ({ key }) => {
  statusLine.textContent = t(currentLang, key);
  if (key === "roomNotFound") {
    setTimeout(() => (window.location.href = "/"), 1500);
  }
});

document.getElementById("copyBtn").addEventListener("click", () => {
  if (!latestState) return;
  navigator.clipboard?.writeText(latestState.code).then(() => {
    document.getElementById("copyBtn").textContent = t(currentLang, "copied");
    setTimeout(() => {
      document.getElementById("copyBtn").textContent = t(currentLang, "copyCode");
    }, 1500);
  });
});

// --- Role picking ---
document.querySelectorAll(".role-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    socket.emit("chooseRole", { team: btn.dataset.team, role: btn.dataset.role });
  });
});

startBtn.addEventListener("click", () => {
  socket.emit("startGame");
});

clueForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const word = clueWordInput.value.trim();
  const number = clueNumberInput.value;
  if (!word) return;
  socket.emit("giveClue", { word, number });
  clueWordInput.value = "";
  clueNumberInput.value = "";
});

endTurnBtn.addEventListener("click", () => {
  socket.emit("endTurn");
});

document.getElementById("playAgainBtn").addEventListener("click", () => {
  socket.emit("playAgain");
});

document.getElementById("leaveBtn").addEventListener("click", () => {
  window.location.href = "/";
});

// --- Main render ---
socket.on("roomState", (state) => {
  latestState = state;
  render(state);
});

function render(state) {
  roomCodeLabel.textContent = state.code;
  scorePill.innerHTML = `
    <span class="score-red">🔴 ${state.remaining.red}</span>
    <span class="score-blue">🔵 ${state.remaining.blue}</span>
  `;

  if (state.status === "lobby") {
    teamPicker.classList.remove("hidden");
    gameArea.classList.add("hidden");
    controlsDock.classList.add("hidden");
    endOverlay.classList.add("hidden");
    renderTeamPicker(state);
    return;
  }

  teamPicker.classList.add("hidden");
  gameArea.classList.remove("hidden");
  controlsDock.classList.remove("hidden");
  renderBoard(state);
  renderTurnBanner(state);
  renderClueBar(state);
  renderControls(state);

  if (state.status === "finished") {
    endOverlay.classList.remove("hidden");
    const won = state.winner;
    winnerText.textContent = t(currentLang, won === "red" ? "winnerRed" : "winnerBlue");
    winnerText.className = won;
  } else {
    endOverlay.classList.add("hidden");
  }
}

function renderTeamPicker(state) {
  document.querySelectorAll(".role-btn").forEach((btn) => {
    const team = btn.dataset.team;
    const role = btn.dataset.role;
    const isMine = state.you && state.you.team === team && state.you.role === role;
    btn.classList.toggle("selected", isMine);

    if (role === "spymaster") {
      const taken = state.players.some((p) => p.team === team && p.role === "spymaster" && !(state.you && p.id === socket.id));
      btn.disabled = taken && !isMine;
    } else {
      btn.disabled = false;
    }
  });

  playerListEl.innerHTML = `<div style="font-weight:700;margin-bottom:8px;">${t(currentLang, "players")}</div>` +
    state.players.map((p) => {
      const tagClass = p.team || "none";
      const roleLabel = p.role ? t(currentLang, p.role === "spymaster" ? "roleSpymaster" : "roleOperative") : "";
      return `<div class="player-row">
        <span>${escapeHtml(p.name)}</span>
        <span class="tag ${tagClass}">${p.team ? t(currentLang, p.team === "red" ? "teamRed" : "teamBlue") : "—"} ${roleLabel ? "· " + roleLabel : ""}</span>
      </div>`;
    }).join("");

  const hasRedSpy = state.players.some((p) => p.team === "red" && p.role === "spymaster");
  const hasBlueSpy = state.players.some((p) => p.team === "blue" && p.role === "spymaster");
  const hasRedOp = state.players.some((p) => p.team === "red" && p.role === "operative");
  const hasBlueOp = state.players.some((p) => p.team === "blue" && p.role === "operative");
  startBtn.disabled = !(hasRedSpy && hasBlueSpy && hasRedOp && hasBlueOp);
}

function renderBoard(state) {
  const isSpymaster = state.you && state.you.role === "spymaster";
  boardEl.innerHTML = state.board.map((card, i) => {
    const revealedClasses = card.revealed ? `revealed ${card.role}` : "";
    const peekClass = !card.revealed && isSpymaster ? `peek-${card.role}` : "";
    const clickable = !card.revealed && state.status === "playing" && state.you && state.you.role === "operative" && state.you.team === state.turn;
    const skull = card.revealed && card.role === "assassin" ? `<span class="skull">💀</span>` : "";
    return `<div class="card ${revealedClasses} ${peekClass} ${clickable ? "" : "not-clickable"}" data-index="${i}">
      ${skull}<span>${escapeHtml(card.word)}</span>
    </div>`;
  }).join("");

  boardEl.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index, 10);
      const card = state.board[idx];
      if (card.revealed) return;
      const clickable = state.status === "playing" && state.you && state.you.role === "operative" && state.you.team === state.turn && state.currentClue;
      if (!clickable) return;
      socket.emit("revealCard", { index: idx });
    });
  });
}

function renderTurnBanner(state) {
  turnBanner.className = `turn-banner ${state.turn}`;
  turnBanner.textContent = t(currentLang, state.turn === "red" ? "turnRed" : "turnBlue");
}

function renderClueBar(state) {
  if (state.currentClue) {
    clueBar.innerHTML = `
      <span class="clue-word">${escapeHtml(state.currentClue.word)}</span>
      <span class="clue-number">${state.currentClue.number}</span>
      <span class="clue-meta">${t(currentLang, "guessesLeft")}: ${state.currentClue.guessesLeft}</span>
    `;
  } else {
    clueBar.innerHTML = `<span>${t(currentLang, "noClueYet")}</span>`;
  }
}

function renderControls(state) {
  const you = state.you;
  if (!you || state.status !== "playing") {
    clueForm.classList.add("hidden");
    endTurnBtn.classList.add("hidden");
    statusLine.textContent = "";
    return;
  }

  const isMyTeamTurn = you.team === state.turn;
  const isSpymaster = you.role === "spymaster";

  if (isSpymaster) {
    if (isMyTeamTurn) {
      if (state.you && state.players.find((p) => p.id === socket.id)) {
        // spymaster gives clue only if their team's turn AND no active clue yet... allow re-clue if needed
      }
      clueForm.classList.toggle("hidden", !!state.currentClue);
      endTurnBtn.classList.add("hidden");
      statusLine.textContent = state.currentClue ? "" : "";
    } else {
      clueForm.classList.add("hidden");
      endTurnBtn.classList.add("hidden");
      statusLine.textContent = t(currentLang, "notYourTurn");
    }
  } else {
    clueForm.classList.add("hidden");
    if (isMyTeamTurn && state.currentClue) {
      endTurnBtn.classList.remove("hidden");
      statusLine.textContent = t(currentLang, "yourTurnToGuess");
    } else if (isMyTeamTurn && !state.currentClue) {
      endTurnBtn.classList.add("hidden");
      statusLine.textContent = t(currentLang, "waitForClue");
    } else {
      endTurnBtn.classList.add("hidden");
      statusLine.textContent = t(currentLang, "notYourTurn");
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
