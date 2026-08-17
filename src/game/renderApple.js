export function drawApple(ctx, apple) {
  const scale = apple.renderScale;
  if (scale <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = apple.renderOpacity;
  ctx.translate(apple.x, apple.y);
  ctx.scale(scale, scale);

  const r = apple.radius;
  const { base, mid, dark, highlight } = apple.palette;

  // Drop shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(2, r * 0.85, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.filter = 'blur(3px)';
  ctx.fill();
  ctx.restore();

  // Stem
  ctx.save();
  ctx.rotate(apple.leafAngle * 0.3);
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = r * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.92);
  ctx.quadraticCurveTo(r * 0.12, -r * 1.2, r * 0.05, -r * 1.35);
  ctx.stroke();
  ctx.restore();

  // Leaf
  ctx.save();
  ctx.translate(r * 0.08, -r * 1.05);
  ctx.rotate(apple.leafAngle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(r * 0.55, -r * 0.35, r * 0.75, 0);
  ctx.quadraticCurveTo(r * 0.55, r * 0.15, 0, 0);
  const leafGrad = ctx.createLinearGradient(0, 0, r * 0.75, 0);
  leafGrad.addColorStop(0, '#5fae4a');
  leafGrad.addColorStop(1, '#3d8a2c');
  ctx.fillStyle = leafGrad;
  ctx.fill();
  ctx.restore();

  // Selection glow ring
  if (apple.selected) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = r * 0.1;
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  }

  // Apple body — twin-lobe silhouette with radial shading
  ctx.save();
  ctx.beginPath();
  drawAppleSilhouette(ctx, r);

  const bodyGrad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  bodyGrad.addColorStop(0, highlight);
  bodyGrad.addColorStop(0.35, base);
  bodyGrad.addColorStop(0.75, mid);
  bodyGrad.addColorStop(1, dark);
  ctx.fillStyle = bodyGrad;

  if (apple.selected) {
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 18;
  }
  ctx.fill();
  ctx.restore();

  // Rim light (subtle inner shadow at bottom-right edge)
  ctx.save();
  ctx.beginPath();
  drawAppleSilhouette(ctx, r);
  ctx.clip();
  const rimGrad = ctx.createRadialGradient(r * 0.4, r * 0.5, r * 0.2, r * 0.4, r * 0.5, r * 1.3);
  rimGrad.addColorStop(0, 'rgba(0,0,0,0)');
  rimGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
  ctx.restore();

  // Specular highlight
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.filter = 'blur(1.5px)';
  ctx.fill();
  ctx.restore();

  // Number label with soft plate for legibility
  ctx.save();
  ctx.font = `800 ${Math.round(r * 0.78)}px "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillText(apple.value, 0.5, r * 0.08 + 1.5);
  ctx.fillStyle = '#fff';
  ctx.fillText(apple.value, 0, r * 0.08);
  ctx.restore();

  ctx.restore();
}

function drawAppleSilhouette(ctx, r) {
  // Two overlapping lobes to create the classic apple dip at top
  ctx.moveTo(0, -r * 0.75);
  ctx.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.05, -r * 0.35, r * 0.95, r * 0.15);
  ctx.bezierCurveTo(r * 0.88, r * 0.85, r * 0.45, r * 1.1, 0, r * 1.05);
  ctx.bezierCurveTo(-r * 0.45, r * 1.1, -r * 0.88, r * 0.85, -r * 0.95, r * 0.15);
  ctx.bezierCurveTo(-r * 1.05, -r * 0.35, -r * 0.55, -r * 1.05, 0, -r * 0.75);
  ctx.closePath();
}
