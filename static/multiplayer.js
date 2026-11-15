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

  function setBanner(updaterFn, color = '#4fc3f7') {
    lastBannerUpdater = updaterFn;
    let banner = document.getElementById('mp-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'mp-banner';
      banner.style.cssText = 'font-size:13px; margin-bottom:8px; padding:4px 12px; border-radius:6px; background:#262a2e; border:1px solid #37474f; font-weight:600; cursor:pointer;';
      banner.title = 'Click to copy room link';
      banner.onclick = () => navigator.clipboard?.writeText(window.location.href).catch(() => {});
      const statusEl = document.getElementById('status');
      if (statusEl && statusEl.parentNode) {
        statusEl.parentNode.insertBefore(banner, statusEl);
      }
    }
    banner.style.color = color;
    banner.innerText = updaterFn();
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

  function getMyIndex() {
    return myIndex;
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
    if (playersCount < 2 && isOnline()) playersCount = 2;
    if (typeof updateUI === 'function') updateUI();
  }

  function handleMessage(msg) {
    if (msg.type === 'room_full') {
      // updateBanner('Комната уже заполнена (2/2). Вы играете локально.', '#ff5252');
      setBanner(() => t('mpFull'), '#ff5252');
      ws = null;
      myIndex = null;
      return;
    }

    if (msg.type === 'joined') {
      myIndex = msg.playerIndex;
      playersCount = msg.playersCount;
      setBanner(() => {
        const role = myIndex === 0 ? t('mpRole1') : t('mpRole2');
        const state = playersCount < 2 ? t('mpWait') : t('mpJoined');
        return `🌐 ${t('mpRoom')} [${roomId}] | ${role} | ${state}`;
      }, '#69f0ae');
      if (typeof updateUI === 'function') updateUI();
      return;
    }

    if (msg.type === 'room_status') {
      playersCount = msg.playersCount;
      if (playersCount >= 2) {
        setBanner(() => {
          const role = myIndex === 0 ? t('mpRole1') : t('mpRole2');
          return `🌐 ${t('mpRoom')} [${roomId}] | ${role} | ${t('mpPlaying')}`;
        }, '#69f0ae');
        if (myIndex === 0) {
          send({ type: 'sync_state', snapshot: getFullSnapshot() });
        }
      } else {
        setBanner(() => {
          const role = myIndex === 0 ? t('mpRole1') : t('mpRole2');
          return `🌐 ${t('mpRoom')} [${roomId}] | ${role} | ${t('mpWait')}`;
        }, '#ffd54f');
      }
      if (typeof updateUI === 'function') updateUI();
      return;
    }

    if (msg.type === 'player_left') {
      playersCount = 1;
      setBanner(() => {
        const role = myIndex === 0 ? t('mpRole1') : t('mpRole2');
        return `🌐 ${t('mpRoom')} [${roomId}] | ${role} | ${t('mpLeft')}`;
      }, '#ff5252');
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
        setBanner(() => t('mpLost'), '#ff5252');
      }
    };
  }

  function toggleJoinControls(inRoom) {
    const input = document.getElementById('mp-room-input');
    const joinBtn = document.getElementById('btn-mp-join');
    const createBtn = document.getElementById('btn-mp');

    if (input) input.style.display = inRoom ? 'none' : 'inline-block';
    if (joinBtn) joinBtn.style.display = inRoom ? 'none' : 'inline-block';
    if (createBtn) {
      createBtn.innerText = inRoom ? t('mpLeave') : t('mpOnline');
      createBtn.style.background = inRoom ? '#c62828' : '#1565c0';
    }
  }

  function joinByCode(rawCode) {
    const cleanCode = String(rawCode || '').trim().toLowerCase();
    if (!cleanCode) return;

    roomId = cleanCode;
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url);

    connect(roomId);
    toggleJoinControls(true);
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
    lastBannerUpdater = null;

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url);

    const banner = document.getElementById('mp-banner');
    if (banner) banner.remove();

    const input = document.getElementById('mp-room-input');
    if (input) input.value = '';

    toggleJoinControls(false);

    if (typeof updateUI === 'function') updateUI();
  }

  function handleMpButtonClick() {
    if (roomId || ws) {
      leaveRoom();
      return;
    }

    const newCode = Math.random().toString(36).substring(2, 7);
    joinByCode(newCode);
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  }

  function initUI() {
    const controls = document.querySelector('.controls');
    if (controls && !document.getElementById('btn-mp')) {
      // Кнопка создания комнаты / выхода
      const createBtn = document.createElement('button');
      createBtn.id = 'btn-mp';
      createBtn.innerText = t('mpOnline');
      createBtn.style.background = '#1565c0';
      createBtn.onclick = handleMpButtonClick;
      controls.appendChild(createBtn);

      // Поле ввода кода комнаты
      const input = document.createElement('input');
      input.id = 'mp-room-input';
      input.type = 'text';
      input.maxLength = 12;
      input.placeholder = t('mpPlaceholder');
      input.onkeydown = (e) => {
        if (e.key === 'Enter') joinByCode(input.value);
      };
      controls.appendChild(input);

      // Кнопка "Войти"
      const joinBtn = document.createElement('button');
      joinBtn.id = 'btn-mp-join';
      joinBtn.innerText = t('mpJoin');
      joinBtn.style.background = '#2e7d32';
      joinBtn.onclick = () => joinByCode(input.value);
      controls.appendChild(joinBtn);
    }

    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom && urlRoom.trim() !== '') {
      joinByCode(urlRoom);
    } else {
      roomId = null;
      myIndex = null;
      playersCount = 0;
      toggleJoinControls(false);
    }
  }

  function refreshLang() {
    const inRoom = Boolean(roomId || ws);
    toggleJoinControls(inRoom);

    const input = document.getElementById('mp-room-input');
    if (input) input.placeholder = t('mpPlaceholder');

    const joinBtn = document.getElementById('btn-mp-join');
    if (joinBtn) joinBtn.innerText = t('mpJoin');

    const banner = document.getElementById('mp-banner');
    if (banner && lastBannerUpdater) {
      banner.innerText = lastBannerUpdater();
    }
  }

  return { initUI, isOnline, isMyTurn, getMyIndex, send, getFullSnapshot, refreshLang };
})();

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => Multiplayer.initUI());
} else {
  Multiplayer.initUI();
}
