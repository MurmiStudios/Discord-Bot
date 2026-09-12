const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const placeholders = require('./placeholders');
const config = require('../config');

// Eine Schrift wird mitgeliefert (Liberation Sans, SIL OFL) statt auf eine
// Systemschrift zu hoffen -- viele schlanke Docker-Images haben gar keine
// Schriften installiert, dann faellt @napi-rs/canvas sonst auf ein
// generisches Monospace zurueck.
const FONT_FAMILY = 'Liberation Sans';
const fontDir = path.join(__dirname, '..', '..', 'assets', 'fonts');
GlobalFonts.registerFromPath(path.join(fontDir, 'LiberationSans-Regular.ttf'), FONT_FAMILY);
GlobalFonts.registerFromPath(path.join(fontDir, 'LiberationSans-Bold.ttf'), FONT_FAMILY);

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitFontSize(ctx, text, maxWidth, startSize, weight) {
  let size = startSize;
  while (size > 10) {
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

// template: Zeile aus image_templates (bereits JSON.parse fuer *_json Spalten).
// ctx: { userName, userTag, guildName, roleName, memberCount, avatarUrl }
async function renderImageTemplate(template, renderCtx) {
  const width = template.width;
  const height = template.height;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Hintergrund
  if (template.bg_type === 'image' && template.bg_image_path) {
    try {
      const img = await loadImage(path.join(config.dataDir, 'uploads', template.bg_image_path));
      const scale = Math.max(width / img.width, height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    } catch (err) {
      ctx.fillStyle = template.bg_color || '#5865f2';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = template.bg_color || '#5865f2';
    ctx.fillRect(0, 0, width, height);
  }

  const dim = Math.min(Math.max(template.bg_dim || 0, 0), 1);
  if (dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${dim})`;
    ctx.fillRect(0, 0, width, height);
  }

  const avatar = template.avatar_json || {};
  if (avatar.enabled) {
    try {
      const size = avatar.size || 90;
      const x = avatar.x != null ? avatar.x : 80;
      const y = avatar.y != null ? avatar.y : height - size - 80;

      ctx.save();
      if (avatar.shape === 'round') {
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
      } else if (avatar.shape === 'rounded') {
        roundedRectPath(ctx, x, y, size, size, size * 0.18);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(x, y, size, size);
        ctx.clip();
      }
      if (renderCtx.avatarUrl) {
        const img = await loadImage(renderCtx.avatarUrl);
        ctx.drawImage(img, x, y, size, size);
      } else {
        // Keine echte Person bekannt (z. B. Vorschau ohne Bot) -- Platzhalter
        // aus Grundfarbe und Initialen statt eines fehlenden Bildes.
        ctx.fillStyle = '#4752c4';
        ctx.fillRect(x, y, size, size);
        const initials = (renderCtx.userName || '?').trim().slice(0, 2).toUpperCase();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${Math.round(size * 0.4)}px ${FONT_FAMILY}`;
        ctx.fillText(initials, x + size / 2, y + size / 2 + 1);
      }
      ctx.restore();

      if (avatar.border > 0) {
        ctx.lineWidth = avatar.border;
        ctx.strokeStyle = '#ffffff';
        if (avatar.shape === 'round') {
          ctx.beginPath();
          ctx.arc(x + size / 2, y + size / 2, size / 2 - avatar.border / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const rr = avatar.shape === 'rounded' ? size * 0.18 : 0;
          roundedRectPath(
            ctx,
            x + avatar.border / 2,
            y + avatar.border / 2,
            size - avatar.border,
            size - avatar.border,
            rr
          );
          ctx.stroke();
        }
      }
    } catch (err) {
      // Kein Profilbild geladen -- die Zeilen werden trotzdem gezeichnet.
    }
  }

  const lines = template.lines_json || [];
  for (const line of lines) {
    const text = placeholders.apply(line.text || '', renderCtx);
    if (!text) continue;
    const weight = line.size >= 28 ? '700' : '400';
    const maxWidth = line.maxWidth || width - 160;
    const size = fitFontSize(ctx, text, maxWidth, line.size || 32, weight);
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    ctx.fillStyle = line.color || '#ffffff';
    ctx.textBaseline = 'alphabetic';

    const align = line.align || template.align || 'left';
    ctx.textAlign = align;

    let x = line.x != null ? line.x : 80;
    if (align === 'center' && line.x == null) x = width / 2;
    if (align === 'right' && line.x == null) x = width - 80;
    const y = line.y != null ? line.y : height - 80;

    if (line.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.fillText(text, x, y);
  }

  return canvas.encode('png');
}

module.exports = { renderImageTemplate };
