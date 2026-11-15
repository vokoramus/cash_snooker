const COLORS_DATA = {
  yellow: { name: 'Жёлтый', val: 2, hex: '#fdd835', x: 180, y: H / 2 + 55 },
  green:  { name: 'Зелёный', val: 3, hex: '#43a047', x: 180, y: H / 2 - 55 },
  brown:  { name: 'Коричневый', val: 4, hex: '#795548', x: 180, y: H / 2 },
  blue:   { name: 'Синий', val: 5, hex: '#1e88e5', x: W / 2, y: H / 2 },
  pink:   { name: 'Розовый', val: 6, hex: '#ec407a', x: W * 0.72, y: H / 2 },
  black:  { name: 'Чёрный', val: 7, hex: '#111111', x: W * 0.91, y: H / 2 }
};

let balls = [];
let players = [];
let turn = 0;
let isMoving = false;
let boughtColor = null;
let pendingRedsToTable = 0;
let ballInHand = true;
let isRespotRed = false;
let respotBonus = [0, 0];
let shotEvents = { firstHit: null, potted: [], cuePotted: false };

function resetGame() {
  players = [
    { reds: 0, debt: 0, colors: [] },
    { reds: 0, debt: 0, colors: [] }
  ];
  turn = 0;
  boughtColor = null;
  pendingRedsToTable = 0;
  ballInHand = true;
  isRespotRed = false;
  respotBonus = [0, 0];
  balls = [];

  balls.push({ type: 'cue', hex: '#ffffff', x: 140, y: H / 2, vx: 0, vy: 0, active: true });

  for (let key in COLORS_DATA) {
    let c = COLORS_DATA[key];
    balls.push({ type: key, hex: c.hex, val: c.val, x: c.x, y: c.y, vx: 0, vy: 0, active: true });
  }

  let startX = COLORS_DATA.pink.x + 22;
  let startY = H / 2;
  let count = 0;
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row <= col; row++) {
      if (count >= 15) break;
      let bx = startX + col * (R * 1.8);
      let by = startY - (col * R) + row * (R * 2.05);
      balls.push({ type: 'red', hex: '#d32f2f', val: 1, x: bx, y: by, vx: 0, vy: 0, active: true });
      count++;
    }
  }

  setGameStatus(() => t('statusStart'));

  if (typeof updateUI === 'function') updateUI();
}

function setStatus(msg) {
  document.getElementById('status').innerText = msg;
}

function hasActiveColors() {
  return balls.some(b => b.active && b.type !== 'cue' && b.type !== 'red');
}

function getScore(idx) {
  let p = players[idx];
  let cSum = p.colors.reduce((acc, c) => acc + c.val, 0);
  return cSum + p.reds + respotBonus[idx];
}

function getScoreDouble(idx) {
  let p = players[idx];
  let cSum = p.colors.reduce((acc, c) => acc + c.val * 2, 0);
  return cSum + p.reds + respotBonus[idx];
}

function buyColor(colorKey) {
  if (isMoving || isRespotRed) return;

  // Повторный клик по уже заказанному шару отменяет заказ до удара
  if (boughtColor === colorKey) {
    boughtColor = null;
    setGameStatus(() => t('statusStart'));
    updateUI();
    return;
  }

  let p = players[turn];
  let cost = COLORS_DATA[colorKey].val;
  let targetBall = balls.find(b => b.type === colorKey && b.active);
  if (!targetBall || p.reds < cost) return;

  // Оплату НЕ списываем до удара — только фиксируем заказ
  boughtColor = colorKey;
  setGameStatus(() => t('statusBought', turn + 1, I18N[currentLang].colors[colorKey], cost));
  updateUI();
}

function spawnRedsOnLine(count) {
  if (count <= 0) return;
  const step = R * 2.15;
  const minX = R + CUSHION + 5;
  const maxX = W - R - CUSHION - 5;

  for (let i = 0; i < count; i++) {
    let placed = false;
    let testX = COLORS_DATA.pink.x + R * 2.2;
    let dir = 1;
    let rowOffset = 0;
    let attempts = 0;

    while (!placed && attempts < 200) {
      attempts++;
      if (dir === 1 && testX > maxX) {
        dir = -1;
        testX = COLORS_DATA.pink.x - R * 2.2;
      } else if (dir === -1 && testX < minX) {
        rowOffset = rowOffset <= 0 ? Math.abs(rowOffset) + R * 2.2 : -rowOffset;
        dir = 1;
        testX = COLORS_DATA.pink.x + R * 2.2;
      }

      let testY = H / 2 + rowOffset;
      let overlap = balls.some(b => b.active && Math.hypot(b.x - testX, b.y - testY) < R * 2.05);
      if (!overlap) {
        balls.push({ type: 'red', hex: '#d32f2f', val: 1, x: testX, y: testY, vx: 0, vy: 0, active: true });
        placed = true;
      } else {
        testX += step * dir;
      }
    }
  }
}

function handleShotEnd() {
  let p = players[turn];
  let foul = false;
  let colorsLeftBefore = hasActiveColors();

  if (shotEvents.cuePotted) foul = true;
  if (!shotEvents.firstHit) foul = true;
  if (boughtColor && shotEvents.firstHit && shotEvents.firstHit.type !== boughtColor) foul = true;
  if (!boughtColor && shotEvents.firstHit && shotEvents.firstHit.type !== 'red') foul = true;

  if (isRespotRed) {
    let redPotted = shotEvents.potted.some(b => b.type === 'red');

    // Фол на Re-spot Red
    if (foul) {
      let winnerIdx = 1 - turn;
      respotBonus[winnerIdx] = 1;
      setGameStatus(() => t('statusRespotFoul', getScore(0), getScore(1), getScoreDouble(0), getScoreDouble(1), winnerIdx + 1));
      updateUI();
      return;
    }

    // Забитие на Re-spot Red
    if (redPotted) {
      respotBonus[turn] = 1;
      setGameStatus(() => t('statusRespotPot', getScore(0), getScore(1), getScoreDouble(0), getScoreDouble(1), turn + 1));
      updateUI();
      return;
    }
    // Промах на Re-spot Red
    turn = 1 - turn;
    setGameStatus(() => t('statusRespotMiss', turn + 1));
    updateUI();
    return;
  }

  let validPot = false;
  let boughtColorPotted = false;

  shotEvents.potted.forEach(b => {
    if (b.type === 'red') {
      if (boughtColor) {
        foul = true;
        b.active = false;
        pendingRedsToTable++;
      } else {
        if (p.debt > 0) {
          p.debt--;
          pendingRedsToTable++;
        } else if (colorsLeftBefore && p.reds >= 8) {
          pendingRedsToTable++;
        } else {
          p.reds++;
        }
        validPot = true;
      }
    } else if (b.type !== 'cue') {
      if (boughtColor === b.type) {
        p.colors.push(b);
        validPot = true;
        boughtColorPotted = true;
      } else {
        foul = true;
        b.active = true;
        b.x = COLORS_DATA[b.type].x;
        b.y = COLORS_DATA[b.type].y;
        b.vx = 0;
        b.vy = 0;
      }
    }
  });

  // 1. Если заказанный цветной ЗАБИТ без фола — списываем его номинал сейчас
  if (boughtColor && boughtColorPotted && !foul) {
    let cost = COLORS_DATA[boughtColor].val;
    p.reds -= cost;
    pendingRedsToTable += cost;
  }

  // 2. Если цветной был заказан, но НЕ забит (и не было фола) — штраф 1 красный за неудачный заказ
  if (boughtColor && !boughtColorPotted && !foul) {
    if (p.reds > 0) {
      p.reds--;
      pendingRedsToTable++;
    } else {
      p.debt++;
    }
  }

  spawnRedsOnLine(pendingRedsToTable);
  pendingRedsToTable = 0;

  // 3. Если был фол — штраф 1 красный (номинал заказанного цветного не сгорает)
  if (foul) {
    validPot = false;
    // Если заказанный цветной успел упасть в одном ударе с фолом — возвращаем его на точку
    if (boughtColorPotted && boughtColor) {
      let cb = balls.find(b => b.type === boughtColor);
      if (cb) {
        p.colors = p.colors.filter(c => c !== cb);
        cb.active = true;
        cb.x = COLORS_DATA[boughtColor].x;
        cb.y = COLORS_DATA[boughtColor].y;
        cb.vx = 0;
        cb.vy = 0;
      }
    }
    if (p.reds > 0) {
      p.reds--;
      spawnRedsOnLine(1);
    } else {
      p.debt++;
    }
  }

  if (shotEvents.cuePotted) {
    let cue = balls.find(b => b.type === 'cue');
    cue.active = true;
    cue.x = 140;
    cue.y = H / 2;
    cue.vx = 0;
    cue.vy = 0;
    ballInHand = true;
  }

  boughtColor = null;

  let anyBallsLeft = balls.some(b => b.active && b.type !== 'cue');
  if (!anyBallsLeft) {
    let s1 = getScore(0);
    let s2 = getScore(1);
    if (s1 === s2 && !isRespotRed) {
      isRespotRed = true;
      balls.push({ type: 'red', hex: '#d32f2f', val: 1, x: COLORS_DATA.black.x, y: H / 2, vx: 0, vy: 0, active: true });
      let cue = balls.find(b => b.type === 'cue');
      cue.x = 140;
      cue.y = H / 2;
      ballInHand = true;
      turn = 1 - turn;
      setGameStatus(() => t('statusTie', turn + 1));
      updateUI();
      return;
    } else {
      let winner = s1 > s2 ? "Игрок 1" : "Игрок 2";
      setGameStatus(() => t('statusWin', s1, s2, getScoreDouble(0), getScoreDouble(1), s1 > s2 ? 1 : 2));
      updateUI();
      return;
    }
  }

  // Обычный ход (фол / промах / серия)
  if (!validPot || foul) {
    turn = 1 - turn;
    setGameStatus(() => foul ? t('statusFoul', turn + 1) : t('statusMiss', turn + 1));
  } else {
    setGameStatus(() => t('statusContinue', turn + 1));
  }

  updateUI();
}
