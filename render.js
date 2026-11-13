const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d');

let isAiming = false;
let aimEnd = { x: 0, y: 0 };

function updateUI() {
  [0, 1].forEach(i => {
    document.getElementById(`p${i + 1}-score`).innerText = getScore(i);
    document.getElementById(`p${i + 1}-debt`).innerText = players[i].debt;
    let limitText = hasActiveColors() ? `${players[i].reds}/8` : `${players[i].reds} (без лимита)`;
    document.getElementById(`p${i + 1}-reds-count`).innerText = limitText;

    let rDiv = document.getElementById(`p${i + 1}-reds`);
    rDiv.innerHTML = '';
    for (let k = 0; k < players[i].reds; k++) {
      rDiv.innerHTML += `<span class="dot" style="background:#d32f2f"></span>`;
    }

    let cDiv = document.getElementById(`p${i + 1}-colors`);
    cDiv.innerHTML = '';
    players[i].colors.forEach(c => {
      cDiv.innerHTML += `<span class="dot" style="background:${c.hex}" title="${c.val}"></span>`;
    });

    document.getElementById(`p${i + 1}-box`).className = `player-box ${turn === i ? 'active-turn' : ''}`;
  });

  let curP = players[turn];
  for (let key in COLORS_DATA) {
    let btn = document.getElementById(`btn-${key}`);
    let ballActive = balls.some(b => b.type === key && b.active);
    btn.disabled = isMoving || boughtColor !== null || !ballActive || curP.reds < COLORS_DATA[key].val;
  }
}

// Точный расчёт касания битка с первым шаром или бортом
function traceAim(cue, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const minX = R + CUSHION;
  const maxX = W - R - CUSHION;
  const minY = R + CUSHION;
  const maxY = H - R - CUSHION;

  let tWall = Infinity;
  if (dx > 0) tWall = Math.min(tWall, (maxX - cue.x) / dx);
  if (dx < 0) tWall = Math.min(tWall, (minX - cue.x) / dx);
  if (dy > 0) tWall = Math.min(tWall, (maxY - cue.y) / dy);
  if (dy < 0) tWall = Math.min(tWall, (minY - cue.y) / dy);

  let closestT = tWall;
  let hitBall = null;
  const hitDist = R * 2;
  const hitDistSq = hitDist * hitDist;

  for (let b of balls) {
    if (!b.active || b.type === 'cue') continue;
    // Вектор от битка к центру шара
    const toBallX = b.x - cue.x;
    const toBallY = b.y - cue.y;
    const proj = toBallX * dx + toBallY * dy;
    if (proj <= 0) continue; // Шар позади удара

    const perpSq = (toBallX * toBallX + toBallY * toBallY) - proj * proj;
    if (perpSq < hitDistSq) {
      const thc = Math.sqrt(hitDistSq - perpSq);
      const t = proj - thc;
      if (t >= 0 && t < closestT) {
        closestT = t;
        hitBall = b;
      }
    }
  }

  return {
    ghostX: cue.x + dx * closestT,
    ghostY: cue.y + dy * closestT,
    hitBall: hitBall
  };
}

// Отрисовка траектории прицельного шара (с 1 отскоком от борта)
function drawTargetTrajectory(startX, startY, dirX, dirY, isLegal) {
  const minX = R + CUSHION;
  const maxX = W - R - CUSHION;
  const minY = R + CUSHION;
  const maxY = H - R - CUSHION;
  const maxLen = 500;

  let tWall = Infinity;
  let hitVertical = false;

  if (dirX > 0) {
    let tx = (maxX - startX) / dirX;
    if (tx < tWall) { tWall = tx; hitVertical = true; }
  } else if (dirX < 0) {
    let tx = (minX - startX) / dirX;
    if (tx < tWall) { tWall = tx; hitVertical = true; }
  }

  if (dirY > 0) {
    let ty = (maxY - startY) / dirY;
    if (ty < tWall) { tWall = ty; hitVertical = false; }
  } else if (dirY < 0) {
    let ty = (minY - startY) / dirY;
    if (ty < tWall) { tWall = ty; hitVertical = false; }
  }

  ctx.save();
  ctx.strokeStyle = isLegal ? '#00e676' : '#ff5252';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  if (tWall >= maxLen) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + dirX * maxLen, startY + dirY * maxLen);
    ctx.stroke();
  } else {
    const bounceX = startX + dirX * tWall;
    const bounceY = startY + dirY * tWall;
    const remLen = maxLen - tWall;
    const refDirX = hitVertical ? -dirX : dirX;
    const refDirY = hitVertical ? dirY : -dirY;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(bounceX, bounceY);
    ctx.lineTo(bounceX + refDirX * remLen, bounceY + refDirY * remLen);
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Резиновые борта по периметру
  ctx.fillStyle = '#134e28';
  ctx.fillRect(0, 0, W, CUSHION);
  ctx.fillRect(0, H - CUSHION, W, CUSHION);
  ctx.fillRect(0, 0, CUSHION, H);
  ctx.fillRect(W - CUSHION, 0, CUSHION, H);

  // Линия дома и сектор D
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(180, CUSHION);
  ctx.lineTo(180, H - CUSHION);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(180, H / 2, 55, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  // Пунктирная линия выставления красных
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(COLORS_DATA.pink.x, H / 2);
  ctx.lineTo(W - CUSHION, H / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Лузы (врезаны в борта)
  ctx.fillStyle = '#0a0a0a';
  for (let p of POCKETS) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
    ctx.fill();
  }

  // Шары
  for (let b of balls) {
    if (!b.active) continue;
    ctx.fillStyle = b.hex;
    ctx.beginPath();
    ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (boughtColor === b.type) {
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Прицел, траектория прицельного и кий
  if (isAiming) {
    let cue = balls.find(b => b.type === 'cue');
    let dx = cue.x - aimEnd.x;
    let dy = cue.y - aimEnd.y;
    let power = Math.min(Math.hypot(dx, dy), 180);
    let angle = Math.atan2(dy, dx);

    const aimInfo = traceAim(cue, angle);

    // 1. Линия пути битка
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(aimInfo.ghostX, aimInfo.ghostY);
    ctx.stroke();
    ctx.restore();

    // 2. Призрачный биток в точке касания
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(aimInfo.ghostX, aimInfo.ghostY, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 3. Будущая траектория прицельного шара
    if (aimInfo.hitBall) {
      const target = aimInfo.hitBall;
      const nx = target.x - aimInfo.ghostX;
      const ny = target.y - aimInfo.ghostY;
      const len = Math.hypot(nx, ny);
      if (len > 0) {
        const isLegal = boughtColor
          ? target.type === boughtColor
          : target.type === 'red';
        drawTargetTrajectory(target.x, target.y, nx / len, ny / len, isLegal);
      }
    }

    // 4. Кий
    ctx.strokeStyle = '#d7ccc8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cue.x - Math.cos(angle) * (R + 5 + power * 0.2), cue.y - Math.sin(angle) * (R + 5 + power * 0.2));
    ctx.lineTo(cue.x - Math.cos(angle) * (R + 85 + power * 0.2), cue.y - Math.sin(angle) * (R + 85 + power * 0.2));
    ctx.stroke();
  }

  if (isMoving) {
    let stillMoving = stepPhysics(balls, shotEvents);
    if (!stillMoving) {
      isMoving = false;
      handleShotEnd();
    }
  }

  requestAnimationFrame(draw);
}

function getPointerPos(e) {
  let rect = canvas.getBoundingClientRect();
  let scaleX = canvas.width / rect.width;
  let scaleY = canvas.height / rect.height;
  let clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
  let clientY = e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function onPointerDown(e) {
  if (isMoving) return;
  let pos = getPointerPos(e);
  let cue = balls.find(b => b.type === 'cue');

  if (ballInHand && pos.x <= 180 && Math.hypot(pos.x - 180, pos.y - H / 2) <= 55) {
    cue.x = pos.x;
    cue.y = pos.y;
    ballInHand = false;
    return;
  }

  if (Math.hypot(pos.x - cue.x, pos.y - cue.y) < 35) {
    isAiming = true;
    aimEnd = pos;
  }
}

function onPointerMove(e) {
  if (!isAiming) return;
  aimEnd = getPointerPos(e);
}

function onPointerUp() {
  if (!isAiming) return;
  isAiming = false;
  let cue = balls.find(b => b.type === 'cue');
  let dx = cue.x - aimEnd.x;
  let dy = cue.y - aimEnd.y;
  let dist = Math.hypot(dx, dy);

  if (dist > 5) {
    let power = Math.min(dist, 180) * 0.11;
    let angle = Math.atan2(dy, dx);
    cue.vx = Math.cos(angle) * power;
    cue.vy = Math.sin(angle) * power;

    shotEvents = { firstHit: null, potted: [], cuePotted: false };
    ballInHand = false;
    isMoving = true;
    updateUI();
  }
}

canvas.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

canvas.addEventListener('touchstart', onPointerDown, { passive: false });
window.addEventListener('touchmove', onPointerMove, { passive: false });
window.addEventListener('touchend', onPointerUp);

resetGame();
draw();
