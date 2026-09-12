const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const placeholders = require('./placeholders');
const { renderImageTemplate } = require('./imageRenderer');

const EMBED_LIMIT = 6000;
const STYLE_MAP = {
  green: ButtonStyle.Success,
  blue: ButtonStyle.Primary,
  red: ButtonStyle.Danger,
  grey: ButtonStyle.Secondary,
};

function computeEmbedLength(embed) {
  if (!embed) return 0;
  let n = 0;
  n += (embed.title || '').length;
  n += (embed.description || '').length;
  n += (embed.footer && embed.footer.text ? embed.footer.text.length : 0);
  n += (embed.author && embed.author.name ? embed.author.name.length : 0);
  for (const f of embed.fields || []) {
    n += (f.name || '').length + (f.value || '').length;
  }
  return n;
}

function buildEmbedData(embed, ctx) {
  if (!embed) return null;
  const applied = placeholders.applyDeep(embed, ctx);
  const data = {};
  if (applied.title) data.title = applied.title.slice(0, 256);
  if (applied.description) data.description = applied.description.slice(0, 4096);
  if (applied.color) data.color = parseInt(String(applied.color).replace('#', ''), 16);
  if (applied.footer && applied.footer.text) data.footer = { text: applied.footer.text.slice(0, 2048) };
  if (applied.author && applied.author.name) data.author = { name: applied.author.name.slice(0, 256) };
  if (Array.isArray(applied.fields) && applied.fields.length) {
    data.fields = applied.fields
      .filter((f) => f.name && f.value)
      .slice(0, 25)
      .map((f) => ({ name: f.name.slice(0, 256), value: f.value.slice(0, 1024), inline: !!f.inline }));
  }
  return data;
}

function buildButtonRows(actionBar, { disabled = false } = {}) {
  const buttons = actionBar.buttons || [];
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const b of buttons.slice(i, i + 5)) {
      // Ein Link-Button ohne Adresse lehnt Discord komplett ab -- lieber den
      // einzelnen Button weglassen als die ganze Nachricht scheitern lassen.
      if (b.style === 'link' && !b.url) continue;

      const btn = new ButtonBuilder().setLabel(b.label || 'Button').setDisabled(disabled);
      if (b.emoji) btn.setEmoji(b.emoji);
      if (b.style === 'link') {
        btn.setStyle(ButtonStyle.Link).setURL(b.url);
      } else {
        btn.setStyle(STYLE_MAP[b.style] || ButtonStyle.Secondary);
        btn.setCustomId(`ab:${actionBar.id}:${b.id}`);
      }
      row.addComponents(btn);
    }
    if (row.components.length) rows.push(row);
  }
  return rows;
}

// Baut die vollstaendige Nachricht (Text, Embed, Bild, Buttons) einmal fuer
// den echten Versand UND fuer die Server-Vorschau -- derselbe Code, damit
// beide garantiert uebereinstimmen.
async function buildMessagePayload({ content, embed, imageTemplate, actionBar }, ctx) {
  const payload = {};
  const text = placeholders.apply(content || '', ctx);
  if (text) payload.content = text;

  const files = [];
  let embedData = embed ? buildEmbedData(embed, ctx) : null;

  if (imageTemplate) {
    const png = await renderImageTemplate(imageTemplate, ctx);
    const attachment = new AttachmentBuilder(png, { name: 'bild.png' });
    files.push(attachment);
    if (embedData) {
      embedData.image = { url: 'attachment://bild.png' };
    } else {
      payload.files = files;
    }
  }

  if (embedData) {
    payload.embeds = [new EmbedBuilder(embedData)];
    if (files.length) payload.files = files;
  }

  if (actionBar) {
    payload.components = buildButtonRows(actionBar);
  }

  return payload;
}

// JSON-taugliche Fassung fuer die Live-Vorschau im Browser -- derselbe
// Embed-/Bild-Code wie beim echten Versand, nur ohne discord.js-Objekte.
async function buildPreviewData({ content, embed, imageTemplate, actionBar }, ctx) {
  const text = placeholders.apply(content || '', ctx);
  const embedData = embed ? buildEmbedData(embed, ctx) : null;
  const embedLength = embed ? computeEmbedLength(placeholders.applyDeep(embed, ctx)) : 0;

  let imageDataUrl = null;
  if (imageTemplate) {
    const png = await renderImageTemplate(imageTemplate, ctx);
    imageDataUrl = `data:image/png;base64,${png.toString('base64')}`;
  }

  return {
    content: text,
    embed: embedData,
    embedLength,
    embedOverLimit: embedLength > EMBED_LIMIT,
    imageDataUrl,
    buttons: actionBar ? actionBar.buttons || [] : [],
  };
}

module.exports = {
  computeEmbedLength,
  buildEmbedData,
  buildButtonRows,
  buildMessagePayload,
  buildPreviewData,
  EMBED_LIMIT,
  STYLE_MAP,
};
