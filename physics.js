const W = 800;
const H = 400;
const R = 9;
const CUSHION = 10;
const FRICTION = 0.985;
const SUBSTEPS = 12;

const POCKETS = [
  { x: 14, y: 14, r: 23, type: 'corner' },
  { x: W / 2, y: -4, r: 20, type: 'side' },
  { x: W - 14, y: 14, r: 23, type: 'corner' },
  { x: 14, y: H - 14, r: 23, type: 'corner' },
  { x: W / 2, y: H + 4, r: 20, type: 'side' },
  { x: W - 14, y: H - 14, r: 23, type: 'corner' }
];

function isNearPocket(x, y) {
  for (let p of POCKETS) {
    if (p.type === 'corner') {
      if (Math.hypot(x - p.x, y - p.y) < p.r + 4) return true;
    } else {
      if (Math.abs(x - p.x) < 15 && (y < R + CUSHION + 2 || y > H - R - CUSHION - 2)) return true;
    }
  }
  return false;
}

function stepPhysics(balls, shotEvents) {
  let movingNow = false;
  const subFriction = Math.pow(FRICTION, 1 / SUBSTEPS);

  for (let step = 0; step < SUBSTEPS; step++) {
    for (let i = 0; i < balls.length; i++) {
      let b = balls[i];
      if (!b.active) continue;

      b.x += b.vx / SUBSTEPS;
      b.y += b.vy / SUBSTEPS;
      b.vx *= subFriction;
      b.vy *= subFriction;

      // Проверка падения в лузу
      for (let p of POCKETS) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < p.r) {
          b.active = false;
          b.vx = 0;
          b.vy = 0;
          if (b.type === 'cue') {
            shotEvents.cuePotted = true;
          } else {
            shotEvents.potted.push(b);
          }
          break;
        }
      }

      if (!b.active) continue;

      // Отскок от бортов (только если шар не входит в створ лузы)
      if (!isNearPocket(b.x, b.y)) {
        if (b.x < R + CUSHION) { b.x = R + CUSHION; b.vx *= -0.85; }
        if (b.x > W - R - CUSHION) { b.x = W - R - CUSHION; b.vx *= -0.85; }
        if (b.y < R + CUSHION) { b.y = R + CUSHION; b.vy *= -0.85; }
        if (b.y > H - R - CUSHION) { b.y = H - R - CUSHION; b.vy *= -0.85; }
      }
    }

    // Упругие столкновения шар-шар
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        let b1 = balls[i], b2 = balls[j];
        if (!b1.active || !b2.active) continue;

        let dx = b2.x - b1.x;
        let dy = b2.y - b1.y;
        let dist = Math.hypot(dx, dy);

        if (dist < R * 2 && dist > 0) {
          if (!shotEvents.firstHit && (b1.type === 'cue' || b2.type === 'cue')) {
            shotEvents.firstHit = b1.type === 'cue' ? b2 : b1;
          }

          let angle = Math.atan2(dy, dx);
          let sin = Math.sin(angle);
          let cos = Math.cos(angle);

          let overlap = (R * 2 - dist) / 2;
          b1.x -= overlap * cos;
          b1.y -= overlap * sin;
          b2.x += overlap * cos;
          b2.y += overlap * sin;

          let vx1 = b1.vx * cos + b1.vy * sin;
          let vy1 = b1.vy * cos - b1.vx * sin;
          let vx2 = b2.vx * cos + b2.vy * sin;
          let vy2 = b2.vy * cos - b2.vx * sin;

          b1.vx = vx2 * cos - vy1 * sin;
          b1.vy = vy1 * cos + vx2 * sin;
          b2.vx = vx1 * cos - vy2 * sin;
          b2.vy = vy2 * cos + vx1 * sin;
        }
      }
    }
  }

  for (let b of balls) {
    if (!b.active) continue;
    if (Math.hypot(b.vx, b.vy) < 0.08) {
      b.vx = 0;
      b.vy = 0;
    } else {
      movingNow = true;
    }
  }

  return movingNow;
}
