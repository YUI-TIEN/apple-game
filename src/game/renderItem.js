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

  // Number label — dark disc behind the glyph so white stays legible on
  // pale crumb, glossy crust and the bagel hole alike.
  ctx.save();
  ctx.rotate(-item.rotation);
  const cy = r * 0.06;
  ctx.font = `800 ${Math.round(r * 0.72)}px "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(45,22,5,0.75)';
  ctx.lineWidth = Math.max(2, r * 0.11);
  ctx.strokeText(item.value, 0, cy);
  ctx.fillStyle = '#fff';
  ctx.fillText(item.value, 0, cy);
  ctx.restore();

  ctx.restore();
}

function drawBread(ctx, item, r) {
  const shape = item.variant.shape;
  if (item.selected) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 18;
  }

  if (shape === 'loaf') drawToast(ctx, item, r);
  else if (shape === 'roll') drawRoll(ctx, item, r);
  else if (shape === 'baguette') drawBaguette(ctx, item, r);
  else if (shape === 'croissant') drawCroissant(ctx, item, r);
  else drawBagel(ctx, item, r);

  if (item.selected) ctx.restore();
}

// --- shared helpers -------------------------------------------------------

// Soft top-left key light shared by every bread so they sit in one scene.
function shadeBody(ctx, pathFn, r, { accent, crumb, crust, dark }, spread = 1.15) {
  ctx.save();
  ctx.beginPath();
  pathFn();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.42, r * 0.06, 0, 0, r * spread);
  g.addColorStop(0, accent);
  g.addColorStop(0.3, crumb);
  g.addColorStop(0.68, crust);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

// Grounding contact shadow under the piece.
function contactShadow(ctx, r, w = 0.72, y = 0.9) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(r * 0.06, r * y, r * w, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.filter = 'blur(4px)';
  ctx.fill();
  ctx.restore();
}

// Baked-surface speckle, clipped to whatever path is already set.
function speckle(ctx, item, r, dark, density = 1) {
  ctx.save();
  ctx.fillStyle = dark;
  item.pores.forEach((p, i) => {
    if (i % 2 === 0 && density < 1) return;
    ctx.globalAlpha = p.alpha * 0.45;
    ctx.beginPath();
    ctx.arc(p.x * r * 0.78, p.y * r * 0.78, p.size * r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// A split in the crust: lens-shaped opening showing paler dough inside,
// with a shadow under the lifted lip. Drawn along +x, caller rotates.
function crustSplit(ctx, r, len, width, colors) {
  const { crumb } = colors;
  ctx.save();

  // Spindle: widest at the middle, tapering to soft blunt tips
  const openPath = () => {
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.bezierCurveTo(-len * 0.55, -width, len * 0.55, -width, len, 0);
    ctx.bezierCurveTo(len * 0.55, width, -len * 0.55, width, -len, 0);
    ctx.closePath();
  };

  // soft shadow spilling onto the crust around the split
  ctx.save();
  openPath();
  ctx.filter = 'blur(3px)';
  ctx.fillStyle = 'rgba(70,34,6,0.5)';
  ctx.fill();
  ctx.restore();

  // interior in shadow, warming toward the lower lip
  openPath();
  const g = ctx.createLinearGradient(0, -width, 0, width);
  g.addColorStop(0, 'rgba(68,34,6,0.95)');
  g.addColorStop(0.55, 'rgba(126,72,24,0.9)');
  g.addColorStop(1, `${crumb}bb`);
  ctx.fillStyle = g;
  ctx.fill();

  // lit lower lip, fading out at the tips
  ctx.save();
  openPath();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-len * 0.75, width * 0.5);
  ctx.quadraticCurveTo(0, width * 1.1, len * 0.75, width * 0.5);
  ctx.strokeStyle = `${crumb}cc`;
  ctx.lineWidth = width * 0.45;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function mottle(ctx, item, r, crust) {
  ctx.save();
  item.mottleSpots.forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(s.x * r * 0.8, s.y * r * 0.8, s.rx * r, s.ry * r, s.rot, 0, Math.PI * 2);
    ctx.fillStyle = s.dark ? `rgba(90,50,15,${s.alpha * 0.8})` : `rgba(255,225,175,${s.alpha * 0.7})`;
    ctx.filter = 'blur(3px)';
    ctx.fill();
  });
  ctx.restore();
}

// --- toast: pale crumb face framed by a browned crust ---------------------

function drawToast(ctx, item, r) {
  const { crust, crumb, dark, accent } = item.variant;
  contactShadow(ctx, r, 0.62, 0.92);

  // Sandwich slice: wide body, rounded base corners, low broad cap that
  // bulges past the sides — the give-away silhouette of a pan loaf.
  const outline = (k = 1) => {
    const w = 0.8 * k;
    const capW = 0.92 * k;
    const base = 0.78 * k;
    ctx.moveTo(-r * w, r * base);
    ctx.lineTo(-r * w, -r * 0.12 * k);
    ctx.bezierCurveTo(-r * capW, -r * 0.52 * k, -r * 0.52 * k, -r * 0.8 * k, 0, -r * 0.8 * k);
    ctx.bezierCurveTo(r * 0.52 * k, -r * 0.8 * k, r * capW, -r * 0.52 * k, r * w, -r * 0.12 * k);
    ctx.lineTo(r * w, r * base);
    ctx.quadraticCurveTo(r * w, r * 0.9 * k, r * 0.62 * k, r * 0.9 * k);
    ctx.lineTo(-r * 0.62 * k, r * 0.9 * k);
    ctx.quadraticCurveTo(-r * w, r * 0.9 * k, -r * w, r * base);
    ctx.closePath();
  };

  // Crust edge — a thin baked rim, not a thick frame
  ctx.save();
  ctx.beginPath();
  outline(1);
  const cg = ctx.createLinearGradient(-r * 0.5, -r, r * 0.5, r);
  cg.addColorStop(0, crust);
  cg.addColorStop(1, dark);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.restore();

  // Crumb face, inset just enough to leave the rim showing
  ctx.save();
  ctx.beginPath();
  outline(0.87);
  ctx.clip();

  const fg = ctx.createRadialGradient(-r * 0.24, -r * 0.34, r * 0.04, 0, 0, r * 1.1);
  fg.addColorStop(0, accent);
  fg.addColorStop(0.6, crumb);
  fg.addColorStop(1, '#e9c98f');
  ctx.fillStyle = fg;
  ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);

  // Airy crumb holes — small, soft, denser toward the middle
  item.pores.forEach((p, i) => {
    if (i % 2 === 0) return;
    const px = p.x * r * 0.5;
    const py = p.y * r * 0.5;
    ctx.beginPath();
    ctx.ellipse(px, py, p.size * r * 0.9, p.size * r * 0.72, p.x, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(196,150,92,${0.16 + p.alpha * 0.2})`;
    ctx.fill();
  });

  // soft shading so the face is not flat
  const faceShade = ctx.createLinearGradient(0, -r * 0.9, 0, r * 0.9);
  faceShade.addColorStop(0, 'rgba(255,255,255,0.1)');
  faceShade.addColorStop(0.6, 'rgba(0,0,0,0)');
  faceShade.addColorStop(1, 'rgba(150,100,45,0.2)');
  ctx.fillStyle = faceShade;
  ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  ctx.restore();
}

// --- roll: domed bun with a flour-dusted cross score ---------------------

function drawRoll(ctx, item, r) {
  const { crust, dark, accent } = item.variant;
  contactShadow(ctx, r, 0.7, 0.86);

  const body = () => organicBlob(ctx, 0, r * 0.06, r * 0.92, 1.02, 0.88, item.edgeSeed);
  shadeBody(ctx, body, r, item.variant, 1.05);

  ctx.save();
  ctx.beginPath();
  body();
  ctx.clip();
  mottle(ctx, item, r, crust);
  speckle(ctx, item, r, dark, 0.5);

  // Split arcs over the crown, clear of the number that sits mid-face
  ctx.save();
  ctx.translate(0, -r * 0.46);
  ctx.rotate(-0.16);
  crustSplit(ctx, r, r * 0.4, r * 0.075, item.variant);
  ctx.restore();

  const rim = ctx.createRadialGradient(r * 0.3, r * 0.42, r * 0.2, r * 0.25, r * 0.35, r * 1.15);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(60,30,5,0.34)');
  ctx.fillStyle = rim;
  ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
  ctx.restore();

  glossHighlight(ctx, -r * 0.3, -r * 0.34, r * 0.26, r * 0.15, 0.4);
}

// --- baguette: long loaf with raised diagonal ears -----------------------

function drawBaguette(ctx, item, r) {
  const { crust, crumb, dark, accent } = item.variant;
  contactShadow(ctx, r, 0.86, 0.66);

  const body = () => organicBlob(ctx, 0, 0, r, 1.22, 0.56, item.edgeSeed);
  shadeBody(ctx, body, r, item.variant, 0.95);

  ctx.save();
  ctx.beginPath();
  body();
  ctx.clip();
  mottle(ctx, item, r, crust);
  speckle(ctx, item, r, dark, 0.5);

  // Diagonal ears flanking the number, kept off the tapered ends
  [-0.62, -0.34, 0.34, 0.62].forEach((t) => {
    ctx.save();
    ctx.translate(r * t, r * 0.02);
    ctx.rotate(-0.85);
    crustSplit(ctx, r, r * 0.19, r * 0.065, item.variant);
    ctx.restore();
  });

  const rim = ctx.createLinearGradient(0, -r * 0.45, 0, r * 0.45);
  rim.addColorStop(0, 'rgba(255,235,190,0.16)');
  rim.addColorStop(0.55, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(60,30,5,0.4)');
  ctx.fillStyle = rim;
  ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
  ctx.restore();

  glossHighlight(ctx, -r * 0.4, -r * 0.16, r * 0.3, r * 0.07, 0.34);
}

// --- croissant: rolled crescent built from overlapping segments ----------

function drawCroissant(ctx, item, r) {
  const { crust, crumb, dark, accent } = item.variant;
  contactShadow(ctx, r, 0.74, 0.7);

  // Crescent: outer edge arcs up over the top, inner edge curves back
  // under it, meeting at two tips that hook slightly downward.
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-r * 0.96, r * 0.36);                                  // left tip
    // outer (upper) edge sweeping over the crown to the right tip
    ctx.bezierCurveTo(-r * 0.9, -r * 0.78, r * 0.9, -r * 0.78, r * 0.96, r * 0.36);
    // tip taper
    ctx.quadraticCurveTo(r * 0.86, r * 0.56, r * 0.64, r * 0.5);
    // inner (lower) edge curving back under the belly
    ctx.bezierCurveTo(r * 0.44, r * 0.16, -r * 0.44, r * 0.16, -r * 0.64, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.86, r * 0.56, -r * 0.96, r * 0.36);
    ctx.closePath();
  };

  ctx.save();
  body();
  const g = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.5);
  g.addColorStop(0, accent);
  g.addColorStop(0.35, crumb);
  g.addColorStop(0.72, crust);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  // Layered rolls across the belly — the laminated identity of a croissant
  ctx.save();
  body();
  ctx.clip();

  // Laminated rolls following the arc — fattest in the middle
  const rolls = [-0.66, -0.34, 0, 0.34, 0.66];
  rolls.forEach((t) => {
    const bulge = 1 - Math.abs(t) * 0.6;
    const cx = t * r * 0.76;
    const cy = r * (0.2 - 0.42 * bulge) + r * 0.18;
    const rw = r * (0.1 + 0.13 * bulge);
    const ry = r * (0.2 + 0.4 * bulge);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.62);
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, ry, 0, 0, Math.PI * 2);
    const rg = ctx.createLinearGradient(-rw, 0, rw, 0);
    rg.addColorStop(0, 'rgba(122,66,16,0.55)');
    rg.addColorStop(0.34, accent);
    rg.addColorStop(0.74, crust);
    rg.addColorStop(1, 'rgba(122,66,16,0.6)');
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.restore();
  });

  // glaze sheen across the top of the arc
  const sheen = ctx.createLinearGradient(0, -r * 0.55, 0, r * 0.1);
  sheen.addColorStop(0, 'rgba(255,240,200,0.34)');
  sheen.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);

  speckle(ctx, item, r, dark, 0.5);
  ctx.restore();
}

// --- bagel: true ring, punched out with even-odd fill --------------------

function drawBagel(ctx, item, r) {
  const { crust, dark, accent } = item.variant;
  contactShadow(ctx, r, 0.72, 0.86);

  const ring = () => {
    organicBlob(ctx, 0, 0, r * 0.92, 1, 0.94, item.edgeSeed);
    ctx.moveTo(r * 0.24, 0);
    ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2, true);
  };

  ctx.save();
  ctx.beginPath();
  ring();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.08, 0, 0, r * 1.1);
  g.addColorStop(0, accent);
  g.addColorStop(0.34, item.variant.crumb);
  g.addColorStop(0.72, crust);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ring();
  ctx.clip('evenodd');
  mottle(ctx, item, r, crust);
  speckle(ctx, item, r, dark, 1);

  // inner wall shadow around the hole
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
  const hole = ctx.createRadialGradient(0, 0, r * 0.28, 0, 0, r * 0.5);
  hole.addColorStop(0, 'rgba(60,30,5,0.55)');
  hole.addColorStop(1, 'rgba(60,30,5,0)');
  ctx.fillStyle = hole;
  ctx.fill();

  const rim = ctx.createRadialGradient(r * 0.28, r * 0.4, r * 0.25, r * 0.2, r * 0.3, r * 1.15);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(55,26,4,0.4)');
  ctx.fillStyle = rim;
  ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
  ctx.restore();

  glossHighlight(ctx, -r * 0.36, -r * 0.44, r * 0.22, r * 0.1, 0.4);
}

function glossHighlight(ctx, x, y, rx, ry, alpha) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.filter = 'blur(2px)';
  ctx.fill();
  ctx.restore();
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
