const Multiplayer = (() => {
  let ws = null;
  let roomId = null;
  let myIndex = null; // 0 = Игрок 1, 1 = Игрок 2, null = локальный режим
  let playersCount = 0;

  function isOnline() {
    return ws !== null && ws.readyState === WebSocket.OPEN && myIndex !== null;
  }

  function isMyTurn() {
    if (!isOnline()) return true;
    return turn === myIndex && playersCount >= 2;
  }

  function send(payload) {
    if (isOnline()) {
      ws.send(JSON.stringify(payload));
    }
  }

  function buildWsUrl(room) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const basePath = window.location.pathname.includes('/cash-snooker') ? '/cash-snooker' : '';
    return `${proto}//${host}${basePath}/ws/${encodeURIComponent(room)}`;
  }

  function updateBanner(text, color = '#4fc3f7') {
    let banner = document.getElementById('mp-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'mp-banner';
      banner.style.cssText = 'font-size:13px; margin-bottom:8px; padding:4px 12px; border-radius:6px; background:#262a2e; border:1px solid #37474f; font-weight:600;';
      const statusEl = document.getElementById('status');
      if (statusEl && statusEl.parentNode) {
        statusEl.parentNode.insertBefore(banner, statusEl);
      }
    }
    banner.style.color = color;
    banner.innerText = text;
  }

  function getFullSnapshot() {
    return {
      balls: balls.map(b => ({
        type: b.type, hex: b.hex, val: b.val,
        x: b.x, y: b.y, vx: 0, vy: 0, active: b.active
      })),
      players: JSON.parse(JSON.stringify(players)),
      turn,
      boughtColor,
      pendingRedsToTable,
      ballInHand,
      isRespotRed,
      respotBonus: [...respotBonus]
    };
  }

  function applySnapshot(snap) {
    if (!snap || !snap.balls) return;
    balls = snap.balls.map(b => ({ ...b }));
    players = snap.players;
    turn = snap.turn;
    boughtColor = snap.boughtColor;
    pendingRedsToTable = snap.pendingRedsToTable;
    ballInHand = snap.ballInHand;
    isRespotRed = snap.isRespotRed;
    respotBonus = snap.respotBonus || Array.of(0, 0);
    isMoving = false;
    isAiming = false;
    if (typeof updateUI === 'function') updateUI();
  }

  function handleMessage(msg) {
    if (msg.type === 'room_full') {
      updateBanner('Комната уже заполнена (2/2). Вы играете локально.', '#ff5252');
      ws = null;
      myIndex = null;
      return;
    }

    if (msg.type === 'joined') {
      myIndex = msg.playerIndex;
      playersCount = msg.playersCount;
      const roleText = myIndex === 0 ? 'Вы: Игрок 1' : 'Вы: Игрок 2';
      const waitText = playersCount < 2 ? 'Ожидание соперника (ссылка скопирована)...' : 'Соперник в комнате!';
      updateBanner(`🌐 Комната [${roomId}] | ${roleText} | ${waitText}`, '#69f0ae');
      if (typeof updateUI === 'function') updateUI();
      return;
    }

    if (msg.type === 'room_status') {
      playersCount = msg.playersCount;
      const roleText = myIndex === 0 ? 'Вы: Игрок 1' : 'Вы: Игрок 2';
      if (playersCount >= 2) {
        updateBanner(`🌐 Комната [${roomId}] | ${roleText} | Матч идёт!`, '#69f0ae');
        // Игрок 1 отправляет текущую расстановку стола вошедшему Игроку 2
        if (myIndex === 0) {
          send({ type: 'sync_state', snapshot: getFullSnapshot() });
        }
      } else {
        updateBanner(`🌐 Комната [${roomId}] | ${roleText} | Ожидание соперника...`, '#ffd54f');
      }
      if (typeof updateUI === 'function') updateUI();
      return;
    }

    if (msg.type === 'player_left') {
      playersCount = 1;
      updateBanner(`🌐 Комната [${roomId}] | Соперник отключился.`, '#ff5252');
      if (typeof updateUI === 'function') updateUI();
      return;
    }

    if (msg.type === 'sync_state') {
      applySnapshot(msg.snapshot);
      return;
    }

    if (msg.type === 'cue_place') {
      const cue = balls.find(b => b.type === 'cue');
      if (cue) {
        cue.x = msg.x;
        cue.y = msg.y;
        ballInHand = false;
      }
      return;
    }

    if (msg.type === 'buy_color') {
      window._remoteAction = true;
      buyColor(msg.colorKey);
      window._remoteAction = false;
      return;
    }

    if (msg.type === 'reset_game') {
      window._remoteAction = true;
      resetGame();
      window._remoteAction = false;
      return;
    }

    if (msg.type === 'shot') {
      const cue = balls.find(b => b.type === 'cue');
      if (!cue) return;
      cue.x = msg.cueX;
      cue.y = msg.cueY;
      cue.vx = Math.cos(msg.angle) * msg.power;
      cue.vy = Math.sin(msg.angle) * msg.power;
      if (typeof SoundFX !== 'undefined') SoundFX.playCueHit(msg.power / (180 * 0.11));

      shotEvents = { firstHit: null, potted: [], cuePotted: false };
      ballInHand = false;
      isMoving = true;
      if (typeof updateUI === 'function') updateUI();
    }
  }

  function connect(room) {
    if (ws) ws.close();
    roomId = room;
    ws = new WebSocket(buildWsUrl(room));
    ws.onmessage = (e) => {
      try {
        handleMessage(JSON.parse(e.data));
      } catch (err) {
        console.error('WS parse error', err);
      }
    };
    ws.onclose = () => {
      if (myIndex !== null) {
        updateBanner('Соединение с сервером потеряно.', '#ff5252');
      }
    };
  }

  function leaveRoom() {
    if (ws) {
      const oldWs = ws;
      ws = null;
      oldWs.close();
    }
    roomId = null;
    myIndex = null;
    playersCount = 0;

    // Убираем параметр ?room=... из адресной строки
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url);

    // Прячем баннер комнаты
    const banner = document.getElementById('mp-banner');
    if (banner) banner.remove();

    // Возвращаем кнопку в исходное состояние
    const btn = document.getElementById('btn-mp');
    if (btn) {
      btn.innerText = '🌐 Онлайн (1 на 1)';
      btn.style.background = '#1565c0';
    }

    if (typeof updateUI === 'function') updateUI();
  }

  function handleMpButtonClick() {
    // Если уже в комнате — выходим обратно в Single Mode
    if (roomId || ws) {
      leaveRoom();
      return;
    }

    // Иначе создаём новую комнату
    roomId = Math.random().toString(36).substring(2, 7);
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url);
    connect(roomId);

    navigator.clipboard?.writeText(window.location.href).catch(() => {});

    const btn = document.getElementById('btn-mp');
    if (btn) {
      btn.innerText = '✖ Выйти в Single Mode';
      btn.style.background = '#c62828';
    }
  }

  function getMyIndex() {
    return myIndex;
  }

  function initUI() {
    const controls = document.querySelector('.controls');
    if (controls && !document.getElementById('btn-mp')) {
      const btn = document.createElement('button');
      btn.id = 'btn-mp';
      btn.innerText = '🌐 Онлайн (1 на 1)';
      btn.style.background = '#1565c0';
      btn.onclick = handleMpButtonClick;
      controls.appendChild(btn);
    }

    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      connect(urlRoom);
      const btn = document.getElementById('btn-mp');
      if (btn) {
        btn.innerText = '✖ Выйти в Single Mode';
        btn.style.background = '#c62828';
      }
    }
  }

  return { initUI, isOnline, isMyTurn, getMyIndex, send, getFullSnapshot };
})();

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => Multiplayer.initUI());
} else {
  Multiplayer.initUI();
}
