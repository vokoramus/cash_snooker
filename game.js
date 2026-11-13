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

  setStatus("Ход Игрока 1. Кликните в секторе D или тяните от битка для удара.");
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
  return cSum + p.reds;
}

function buyColor(colorKey) {
  if (isMoving || boughtColor || isRespotRed) return;
  let p = players[turn];
  let cost = COLORS_DATA[colorKey].val;
  let targetBall = balls.find(b => b.type === colorKey && b.active);
  if (!targetBall || p.reds < cost) return;

  p.reds -= cost;
  boughtColor = colorKey;
  pendingRedsToTable += cost;
  setStatus(`Игрок ${turn + 1} купил ${COLORS_DATA[colorKey].name} за ${cost} красных! Бейте по нему.`);
  updateUI();
}

function spawnRedsOnLine(count) {
  if (count <= 0) return;
  let startX = COLORS_DATA.pink.x + R * 2.2;
  let step = R * 2.15;
  let dir = 1;

  for (let i = 0; i < count; i++) {
    let placed = false;
    let testX = startX;
    while (!placed) {
      if (testX > W - 25) {
        dir = -1;
        testX = COLORS_DATA.pink.x - R * 2.2;
      }
      let overlap = balls.some(b => b.active && Math.hypot(b.x - testX, b.y - H / 2) < R * 2.05);
      if (!overlap) {
        balls.push({ type: 'red', hex: '#d32f2f', val: 1, x: testX, y: H / 2, vx: 0, vy: 0, active: true });
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

  let validPot = false;
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

  spawnRedsOnLine(pendingRedsToTable);
  pendingRedsToTable = 0;

  if (foul) {
    validPot = false;
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
      ballInHand = true;
      turn = 1 - turn;
      setStatus(`НИЧЬЯ 21:21! Объявляется RE-SPOT RED! Игрок ${turn + 1} бьёт с руки.`);
      updateUI();
      return;
    } else {
      let winner = s1 > s2 ? "Игрок 1" : "Игрок 2";
      setStatus(`ПАРТИЯ ОКОНЧЕНА! Счёт ${s1}:${s2}. Победил ${winner}!`);
      updateUI();
      return;
    }
  }

  if (!validPot || foul) {
    turn = 1 - turn;
    setStatus(foul ? `ФОЛ! Штраф 1 красный. Ход переходит к Игроку ${turn + 1}.` : `Промах. Ход Игрока ${turn + 1}.`);
  } else {
    setStatus(`Отличный удар! Игрок ${turn + 1} продолжает серию.`);
  }

  updateUI();
}
