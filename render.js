const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d');

let isAiming = false;
let aimEnd = { x: 0, y: 0 };
const CANCEL_RADIUS = R + 5; // Радиус возврата к битку для отмены удара

function updateUI() {
  for (let i = 0; i < 2; i++) {
    const scoreEl = document.getElementById(`p${i + 1}-score`);
    const debtEl = document.getElementById(`p${i + 1}-debt`);

    if (scoreEl) {
      scoreEl.innerText = getScore(i);

      // Находим или оборачиваем блок "Долг", чтобы управлять его позицией и прозрачностью
      let debtWrap = document.getElementById(`p${i + 1}-debt-wrap`);
      if (!debtWrap && debtEl && debtEl.parentElement) {
        debtWrap = document.createElement('span');
        debtWrap.id = `p${i + 1}-debt-wrap`;
        debtWrap.className = 'debt-badge';
        debtWrap.innerHTML = ` | Долг: <strong id="p${i + 1}-debt">0</strong>`;

        // Удаляем старый текстовый узел " | Долг: " и старый span из шапки
        const parent = debtEl.parentElement;
        const nodes = Array.from(parent.childNodes);
        nodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Долг')) {
            parent.removeChild(node);
          }
        });
        parent.removeChild(debtEl);
        parent.appendChild(debtWrap);
      }

      // Создаём или находим "Счёт 2" и ставим его строго ПЕРЕД блоком "Долг"
      let score2Wrap = document.getElementById(`p${i + 1}-score2-wrap`);
      if (!score2Wrap && scoreEl.parentElement) {
        score2Wrap = document.createElement('span');
        score2Wrap.id = `p${i + 1}-score2-wrap`;
        score2Wrap.className = 'score2-badge';
        score2Wrap.innerHTML = ` | Счёт 2: <strong id="p${i + 1}-score2">0</strong>`;

        const targetDebtWrap = document.getElementById(`p${i + 1}-debt-wrap`);
        if (targetDebtWrap && targetDebtWrap.parentElement === scoreEl.parentElement) {
          scoreEl.parentElement.insertBefore(score2Wrap, targetDebtWrap);
        } else {
          scoreEl.parentElement.appendChild(score2Wrap);
        }
      }

      const score2El = document.getElementById(`p${i + 1}-score2`);
      if (score2El) {
        score2El.innerText = getScoreDouble(i);
      }
    }

    const updatedDebtEl = document.getElementById(`p${i + 1}-debt`);
    const updatedDebtWrap = document.getElementById(`p${i + 1}-debt-wrap`);
    if (updatedDebtEl) {
      updatedDebtEl.innerText = players[i].debt;
    }
    if (updatedDebtWrap) {
      if (players[i].debt === 0) {
        updatedDebtWrap.classList.add('debt-zero');
        updatedDebtWrap.classList.remove('debt-active');
      } else {
        updatedDebtWrap.classList.remove('debt-zero');
        updatedDebtWrap.classList.add('debt-active');
      }
    }

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
      cDiv.innerHTML += `<span class="dot" style="background:${c.hex}" title="${c.val} (2x: ${c.val * 2})"></span>`;
    });

    document.getElementById(`p${i + 1}-box`).className = `player-box ${turn === i ? 'active-turn' : ''}`;
  }

  let curP = players[turn];
  for (let key in COLORS_DATA) {
    let btn = document.getElementById(`btn-${key}`);
    let ballActive = balls.some(b => b.type === key && b.active);
    btn.disabled = isMoving || boughtColor !== null || !ballActive || curP.reds < COLORS_DATA[key].val;
  }
}

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
    const toBallX = b.x - cue.x;
    const toBallY = b.y - cue.y;
    const proj = toBallX * dx + toBallY * dy;
    if (proj <= 0) continue;

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

// Точный расчёт пробега шара до полной остановки по физике SUBSTEPS
function calcStopDistance(v0) {
  if (v0 <= 0.08) return 0;
  const subFriction = Math.pow(FRICTION, 1 / SUBSTEPS);
  let v = v0;
  let dist = 0;
  let guard = 0;
  while (v >= 0.08 && guard < 4000) {
    dist += v / SUBSTEPS;
    v *= subFriction;
    guard++;
  }
  return dist;
}

// Расчёт скорости битка после прохождения дистанции travelDist
function calcSpeedAfterDist(v0, travelDist) {
  if (v0 <= 0.08) return 0;
  const subFriction = Math.pow(FRICTION, 1 / SUBSTEPS);
  let v = v0;
  let d = 0;
  let guard = 0;
  while (v >= 0.08 && d < travelDist && guard < 4000) {
    d += v / SUBSTEPS;
    v *= subFriction;
    guard++;
  }
  return v >= 0.08 ? v : 0;
}

// Отрисовка пунктирного кружка в точке остановки шара
function drawStopMarker(x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Луч движения шара с учётом 1 отскока от борта и реальной дистанции остановки
function drawBounceRay(startX, startY, dirX, dirY, color, maxVisualLen, stopDist, dashPattern) {
  const minX = R + CUSHION;
  const maxX = W - R - CUSHION;
  const minY = R + CUSHION;
  const maxY = H - R - CUSHION;

  const isStoppingShort = stopDist < maxVisualLen;
  const effectiveLen = Math.min(maxVisualLen, stopDist);
  if (effectiveLen <= 1) {
    drawStopMarker(startX, startY, color);
    return;
  }

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
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dashPattern || []);

  let endX, endY;
  if (tWall >= effectiveLen) {
    endX = startX + dirX * effectiveLen;
    endY = startY + dirY * effectiveLen;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  } else {
    const bounceX = startX + dirX * tWall;
    const bounceY = startY + dirY * tWall;
    // Учитываем потерю скорости 0.85 при отскоке от борта
    const remLen = (effectiveLen - tWall) * 0.85;
    const refDirX = hitVertical ? -dirX : dirX;
    const refDirY = hitVertical ? dirY : -dirY;
    endX = bounceX + refDirX * remLen;
    endY = bounceY + refDirY * remLen;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(bounceX, bounceY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  ctx.restore();

  if (isStoppingShort) {
    drawStopMarker(endX, endY, color);
  }
}

// Вертикальный индикатор силы удара справа
function ensurePowerBarUI() {
  let barWrap = document.getElementById('power-bar-wrap');
  if (barWrap) return barWrap;

  // Оборачиваем canvas, чтобы поставить прогресс-бар строго справа от стола
  const wrapper = document.createElement('div');
  wrapper.className = 'table-stage';
  canvas.parentNode.insertBefore(wrapper, canvas);
  wrapper.appendChild(canvas);

  barWrap = document.createElement('div');
  barWrap.id = 'power-bar-wrap';
  barWrap.className = 'power-bar-container';
  barWrap.innerHTML = `
    <div class="power-bar-track">
      <div id="power-bar-fill" class="power-bar-fill"></div>
    </div>
    <div id="power-bar-label" class="power-bar-label">0%</div>
  `;
  wrapper.appendChild(barWrap);
  return barWrap;
}

function updatePowerBar(powerRatio, active) {
  const barWrap = ensurePowerBarUI();
  const fill = document.getElementById('power-bar-fill');
  const label = document.getElementById('power-bar-label');

  if (!active) {
    barWrap.classList.remove('active');
    fill.style.height = '0%';
    label.innerText = '0%';
    return;
  }

  barWrap.classList.add('active');
  const pct = Math.round(powerRatio * 100);
  fill.style.height = `${pct}%`;
  label.innerText = `${pct}%`;
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

  // Лузы
  ctx.fillStyle = '#0a0a0a';
  for (let p of POCKETS) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
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

  // Прицел, траектория прицельного, отскок битка и кий
  if (isAiming) {
    let cue = balls.find(b => b.type === 'cue');
    let dx = cue.x - aimEnd.x;
    let dy = cue.y - aimEnd.y;
    let dist = Math.hypot(dx, dy);

    // Зона отмены прицела при возврате к битку
    if (dist <= CANCEL_RADIUS) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 82, 82, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cue.x, cue.y, CANCEL_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ОТМЕНА', cue.x, cue.y - CANCEL_RADIUS - 8);
      ctx.restore();
    } else {
      let pull = Math.min(dist, 180);
      let powerRatio = pull / 180;
      let v0 = pull * 0.11;
      let angle = Math.atan2(dy, dx);
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);

      const aimInfo = traceAim(cue, angle);
      const distToHit = Math.hypot(aimInfo.ghostX - cue.x, aimInfo.ghostY - cue.y);
      const cueTotalStopDist = calcStopDistance(v0);

      // Если биток остановится раньше, чем доедет до точки касания
      if (cueTotalStopDist < distToHit) {
        const stopX = cue.x + dirX * cueTotalStopDist;
        const stopY = cue.y + dirY * cueTotalStopDist;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cue.x, cue.y);
        ctx.lineTo(stopX, stopY);
        ctx.stroke();
        ctx.restore();

        drawStopMarker(stopX, stopY, 'rgba(255, 255, 255, 0.85)');
      } else {
        // 1. Линия пути битка до точки касания
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

        const vImpact = calcSpeedAfterDist(v0, distToHit);

        // 3. Траектория прицельного и отскок битка с учётом реальной силы
        if (aimInfo.hitBall && vImpact > 0.08) {
          const target = aimInfo.hitBall;
          const nx = target.x - aimInfo.ghostX;
          const ny = target.y - aimInfo.ghostY;
          const len = Math.hypot(nx, ny);
          if (len > 0) {
            const ux = nx / len;
            const uy = ny / len;
            const isLegal = boughtColor
              ? target.type === boughtColor
              : target.type === 'red';

            const cosCut = Math.max(0, dirX * ux + dirY * uy);
            const vTarget = vImpact * cosCut;
            const targetStopDist = calcStopDistance(vTarget);

            drawBounceRay(
              target.x,
              target.y,
              ux,
              uy,
              isLegal ? '#00e676' : '#ff5252',
              500,
              targetStopDist,
              [6, 4]
            );

            let tx = -uy;
            let ty = ux;
            if (dirX * tx + dirY * ty < 0) {
              tx = -tx;
              ty = -ty;
            }
            const sinCut = Math.abs(dirX * tx + dirY * ty);
            if (sinCut > 0.05) {
              const vCueAfter = vImpact * sinCut;
              const cueAfterStopDist = calcStopDistance(vCueAfter);
              drawBounceRay(
                aimInfo.ghostX,
                aimInfo.ghostY,
                tx,
                ty,
                '#4fc3f7',
                260,
                cueAfterStopDist,
                [4, 4]
              );
            }
          }
        } else if (!aimInfo.hitBall && vImpact > 0.08) {
          // Отскок битка от борта с учётом потери скорости 0.85
          const vAfterWall = vImpact * 0.85;
          const wallStopDist = calcStopDistance(vAfterWall);
          drawBounceRay(
            aimInfo.ghostX,
            aimInfo.ghostY,
            dirX,
            dirY,
            'rgba(79, 195, 247, 0.75)',
            260,
            wallStopDist,
            [4, 4]
          );
        }
      }

      // 4. Кий и вертикальный индикатор силы
      ctx.strokeStyle = '#d7ccc8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cue.x - dirX * (R + 5 + pull * 0.2), cue.y - dirY * (R + 5 + pull * 0.2));
      ctx.lineTo(cue.x - dirX * (R + 85 + pull * 0.2), cue.y - dirY * (R + 85 + pull * 0.2));
      ctx.stroke();

      updatePowerBar(powerRatio, true);

    }
  }

  if (!isAiming || Math.hypot(balls.find(b => b.type === 'cue').x - aimEnd.x, balls.find(b => b.type === 'cue').y - aimEnd.y) <= CANCEL_RADIUS) {
    updatePowerBar(0, false);
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

function cancelAim() {
  isAiming = false;
}

function onPointerDown(e) {
  if (isMoving) return;

  // Правая кнопка мыши во время прицеливания отменяет прицел
  if (e.button === 2) {
    if (isAiming) cancelAim();
    return;
  }

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

function onPointerUp(e) {
  if (!isAiming) return;
  if (e && e.button === 2) return;

  isAiming = false;
  let cue = balls.find(b => b.type === 'cue');
  let dx = cue.x - aimEnd.x;
  let dy = cue.y - aimEnd.y;
  let dist = Math.hypot(dx, dy);

  if (dist > CANCEL_RADIUS) {
    let power = Math.min(dist, 180) * 0.11;
    let angle = Math.atan2(dy, dx);
    cue.vx = Math.cos(angle) * power;
    cue.vy = Math.sin(angle) * power;

    SoundFX.playCueHit(Math.min(dist, 180) / 180);

    shotEvents = { firstHit: null, potted: [], cuePotted: false };
    ballInHand = false;
    isMoving = true;
    updateUI();
  }
}

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (isAiming) cancelAim();
});
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isAiming) cancelAim();
});

canvas.addEventListener('touchstart', onPointerDown, { passive: false });
window.addEventListener('touchmove', onPointerMove, { passive: false });
window.addEventListener('touchend', onPointerUp);

resetGame();
draw();
