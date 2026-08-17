export function drawItem(ctx, item) {
  const scale = item.renderScale;
  if (scale <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = item.renderOpacity;
  ctx.translate(item.x, item.y);
  ctx.scale(scale, scale);
  ctx.rotate(item.rotation);

  const r = item.radius;

  // Drop shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(2, r * 0.85, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.filter = 'blur(3px)';
  ctx.fill();
  ctx.restore();

  if (item.selected) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.28, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = r * 0.1;
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  }

  if (item.type === 'bread') {
    drawBread(ctx, item, r);
  } else {
    drawCoffeeBeans(ctx, item, r);
  }

  // Number label with soft plate for legibility
  ctx.save();
  ctx.rotate(-item.rotation);
  ctx.font = `800 ${Math.round(r * 0.78)}px "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillText(item.value, 0.5, r * 0.08 + 1.5);
  ctx.fillStyle = '#fff';
  ctx.fillText(item.value, 0, r * 0.08);
  ctx.restore();

  ctx.restore();
}

function drawBread(ctx, item, r) {
  const { crust, crumb, dark, accent } = item.variant;
  const shape = item.variant.shape;

  ctx.save();
  ctx.beginPath();
  breadSilhouette(ctx, shape, r, item.edgeSeed);

  const bodyGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.05, 0, 0, r * 1.2);
  bodyGrad.addColorStop(0, accent);
  bodyGrad.addColorStop(0.22, crumb);
  bodyGrad.addColorStop(0.55, crust);
  bodyGrad.addColorStop(0.85, dark);
  bodyGrad.addColorStop(1, dark);
  ctx.fillStyle = bodyGrad;
  if (item.selected) {
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 18;
  }
  ctx.fill();
  ctx.restore();

  // Clipped detail layer: mottled bake spots, pores, scoring, rim shading
  ctx.save();
  ctx.beginPath();
  breadSilhouette(ctx, shape, r, item.edgeSeed);
  ctx.clip();

  drawBakeMottle(ctx, item, r, dark, crust);
  drawPores(ctx, item, r, dark);
  drawScoring(ctx, shape, r, dark, accent);

  const rimGrad = ctx.createRadialGradient(r * 0.35, r * 0.5, r * 0.2, r * 0.35, r * 0.5, r * 1.3);
  rimGrad.addColorStop(0, 'rgba(0,0,0,0)');
  rimGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
  ctx.restore();

  // Specular highlight
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.35, r * 0.24, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.filter = 'blur(1.5px)';
  ctx.fill();
  ctx.restore();
}

// Uneven bake coloring — irregular soft blotches, darker toward the seeded angle
function drawBakeMottle(ctx, item, r, dark, crust) {
  const spots = item.mottleSpots;
  ctx.save();
  spots.forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(s.x * r, s.y * r, s.rx * r, s.ry * r, s.rot, 0, Math.PI * 2);
    ctx.fillStyle = s.dark ? `rgba(0,0,0,${s.alpha})` : `${crust}${Math.round(s.alpha * 255).toString(16).padStart(2, '0')}`;
    ctx.filter = 'blur(2px)';
    ctx.fill();
  });
  ctx.restore();
}

// Fine surface pores — small irregular dots for a grainy crust texture
function drawPores(ctx, item, r, dark) {
  ctx.save();
  ctx.fillStyle = dark;
  item.pores.forEach((p) => {
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x * r, p.y * r, p.size * r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// Scoring cuts rendered as a groove: dark shadow edge + light rim for depth
function drawScoringLine(ctx, path, r, dark, accent) {
  ctx.save();
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.4, r * 0.05);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.55;
  ctx.stroke(path);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(0.8, r * 0.02);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.5;
  const p2 = new Path2D();
  p2.addPath(path, new DOMMatrix().translate(r * 0.03, r * 0.03));
  ctx.stroke(p2);
  ctx.restore();
}

function drawScoring(ctx, shape, r, dark, accent) {
  if (shape === 'loaf') {
    for (let i = -1; i <= 1; i++) {
      const p = new Path2D();
      p.moveTo(r * 0.35 * i, -r * 0.6);
      p.lineTo(r * 0.35 * i, r * 0.5);
      drawScoringLine(ctx, p, r, dark, accent);
    }
  } else if (shape === 'roll') {
    const p = new Path2D();
    p.moveTo(-r * 0.4, -r * 0.1);
    p.quadraticCurveTo(0, -r * 0.5, r * 0.4, -r * 0.1);
    drawScoringLine(ctx, p, r, dark, accent);
  } else if (shape === 'baguette') {
    for (let i = -2; i <= 2; i++) {
      const p = new Path2D();
      p.moveTo(r * 0.4 * i - r * 0.15, -r * 0.32);
      p.lineTo(r * 0.4 * i + r * 0.15, r * 0.28);
      drawScoringLine(ctx, p, r, dark, accent);
    }
  } else if (shape === 'croissant') {
    const p = new Path2D();
    p.moveTo(-r * 0.55, -r * 0.15);
    p.quadraticCurveTo(-r * 0.1, r * 0.05, r * 0.35, -r * 0.25);
    drawScoringLine(ctx, p, r, dark, accent);
    const p2 = new Path2D();
    p2.moveTo(-r * 0.35, r * 0.15);
    p2.quadraticCurveTo(0, r * 0.32, r * 0.3, r * 0.05);
    drawScoringLine(ctx, p2, r, dark, accent);
  } else {
    // Bagel: inner ring hole rendered as a shaded well
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    const holeGrad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 0.42);
    holeGrad.addColorStop(0, 'rgba(0,0,0,0.05)');
    holeGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = holeGrad;
    ctx.fill();
    ctx.restore();
  }
}

// Draws a closed organic blob by perturbing a circle's radius at N points
// and interpolating with quadratic curves through their midpoints.
function organicBlob(ctx, cx, cy, baseR, xScale, yScale, seed) {
  const n = seed.length;
  const pts = seed.map((mul, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      x: cx + Math.cos(a) * baseR * mul * xScale,
      y: cy + Math.sin(a) * baseR * mul * yScale,
    };
  });
  ctx.moveTo((pts[0].x + pts[n - 1].x) / 2, (pts[0].y + pts[n - 1].y) / 2);
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n];
    const mid = { x: (pts[i].x + next.x) / 2, y: (pts[i].y + next.y) / 2 };
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y);
  }
  ctx.closePath();
}

function breadSilhouette(ctx, shape, r, seed) {
  if (shape === 'loaf') {
    // Sliced toast: rounded-top square with a slightly uneven crust edge
    const j = seed || [1, 1, 1, 1, 1, 1, 1, 1];
    ctx.moveTo(-r * 0.85 * j[0], r * 0.9);
    ctx.lineTo(-r * 0.87 * j[1], -r * 0.3);
    ctx.quadraticCurveTo(-r * 0.85 * j[2], -r * 1.05 * j[3], 0, -r * 1.05 * j[4]);
    ctx.quadraticCurveTo(r * 0.85 * j[5], -r * 1.05 * j[6], r * 0.87 * j[7], -r * 0.3);
    ctx.lineTo(r * 0.85 * j[0], r * 0.9);
    ctx.closePath();
  } else if (shape === 'roll') {
    // Round dinner roll — organic, never a perfect circle
    organicBlob(ctx, 0, 0, r * 0.95, 1, 1, seed || Array(10).fill(1));
  } else if (shape === 'baguette') {
    // Elongated stick, narrower than a bean's oval, with rounded uneven ends
    organicBlob(ctx, 0, 0, r, 1.15, 0.48, seed || Array(10).fill(1));
  } else if (shape === 'croissant') {
    // Crescent shape
    ctx.arc(0, 0, r * 0.95, 0.35 * Math.PI, 1.75 * Math.PI, false);
    ctx.arc(r * 0.25, 0, r * 0.55, 1.6 * Math.PI, 0.5 * Math.PI, true);
    ctx.closePath();
  } else {
    // Bagel: organic ring outline
    organicBlob(ctx, 0, 0, r * 0.95, 1, 1, seed || Array(10).fill(1));
  }
}

function drawCoffeeBeans(ctx, item, r) {
  const count = item.beanCount || 1;
  if (count === 1) {
    drawSingleBean(ctx, item.variant, 0, 0, r * 0.88, 0.15);
  } else {
    drawSingleBean(ctx, item.variant, -r * 0.34, r * 0.2, r * 0.66, -0.5);
    drawSingleBean(ctx, item.variant, r * 0.34, -r * 0.18, r * 0.66, 0.5);
  }
}

function drawSingleBean(ctx, variant, cx, cy, br, angle) {
  const { base, mid, dark, sheen } = variant;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.ellipse(0, 0, br * 0.72, br, 0, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(-br * 0.25, -br * 0.35, br * 0.1, 0, 0, br * 1.1);
  grad.addColorStop(0, sheen);
  grad.addColorStop(0.45, base);
  grad.addColorStop(0.8, mid);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fill();

  // Center crease
  ctx.beginPath();
  ctx.moveTo(0, -br * 0.8);
  ctx.quadraticCurveTo(br * 0.22, 0, 0, br * 0.8);
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.2, br * 0.12);
  ctx.lineCap = 'round';
  ctx.stroke();

  // Highlight
  ctx.beginPath();
  ctx.ellipse(-br * 0.22, -br * 0.3, br * 0.18, br * 0.11, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.filter = 'blur(1px)';
  ctx.fill();

  ctx.restore();
}
