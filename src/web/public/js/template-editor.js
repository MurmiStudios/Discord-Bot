/**
 * Vorlagen-Editor mit Live-Vorschau.
 *
 * Die Vorschau wird bewusst auf dem Server gerendert — mit demselben Renderer,
 * der auch die echten DMs erzeugt. Ein im Browser nachgebauter Canvas würde bei
 * Schrift und Kerning abweichen und die Vorschau unzuverlässig machen.
 */
import { csrfToken } from './common.js';

const formular = document.getElementById('vorlagen-formular');
const vorschau = document.getElementById('vorschau');
const status = document.getElementById('vorschau-status');
const configFeld = document.getElementById('config-feld');
const nutzerAuswahl = document.getElementById('vorschau-nutzer');
const daten = JSON.parse(document.getElementById('vorlagen-daten').textContent);

/** Aktueller Layout-Stand; die Formularfelder schreiben hier hinein. */
const config = structuredClone(daten.config);

const holen = (pfad) => pfad.split('.').reduce((o, k) => o?.[k], config);
const setzen = (pfad, wert) => {
  const teile = pfad.split('.');
  const letzter = teile.pop();
  teile.reduce((o, k) => (o[k] ??= {}), config)[letzter] = wert;
};

/** Formularfelder mit dem Layout-Objekt verbinden (beide Richtungen). */
const felder = [...formular.querySelectorAll('[data-pfad]')];

for (const feld of felder) {
  const pfad = feld.dataset.pfad;
  const wert = holen(pfad);

  if (feld.type === 'checkbox') feld.checked = Boolean(wert);
  else if (wert !== undefined && wert !== null) feld.value = wert;

  feld.addEventListener('input', () => {
    if (feld.type === 'checkbox') setzen(pfad, feld.checked);
    else if (feld.type === 'number') setzen(pfad, Number(feld.value));
    else setzen(pfad, feld.value);
    vorschauAnfordern();
  });
}

const breiteFeld = document.getElementById('f-width');
const hoeheFeld = document.getElementById('f-height');
breiteFeld?.addEventListener('input', vorschauAnfordern);
hoeheFeld?.addEventListener('input', vorschauAnfordern);
nutzerAuswahl?.addEventListener('change', vorschauAnfordern);

let letzteUrl = null;
let entprellung;
let laufend = false;
let nachgefragt = false;

function vorschauAnfordern() {
  clearTimeout(entprellung);
  entprellung = setTimeout(vorschauLaden, 250);
}

async function vorschauLaden() {
  // Nur eine Anfrage gleichzeitig; eine währenddessen angeforderte wird
  // danach einmal nachgeholt.
  if (laufend) {
    nachgefragt = true;
    return;
  }
  laufend = true;

  try {
    const res = await fetch('/vorlagen/vorschau.png', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({
        templateId: daten.id,
        width: Number(breiteFeld.value),
        height: Number(hoeheFeld.value),
        config,
        userId: nutzerAuswahl?.value || null,
      }),
    });

    if (!res.ok) {
      status.textContent = `Vorschau fehlgeschlagen (HTTP ${res.status}).`;
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    vorschau.src = url;
    // Alte Blob-URL freigeben, sonst wächst der Speicher bei jedem Tastendruck.
    if (letzteUrl) URL.revokeObjectURL(letzteUrl);
    letzteUrl = url;
    status.textContent = 'Ziehe das Profilbild oder die Texte direkt im Bild, um sie zu positionieren.';
  } catch (err) {
    status.textContent = `Vorschau fehlgeschlagen: ${err.message}`;
  } finally {
    laufend = false;
    if (nachgefragt) {
      nachgefragt = false;
      vorschauLaden();
    }
  }
}

/* ── Direktes Positionieren per Ziehen ───────────────────────────────────── */

/** Rechnet Bildschirmkoordinaten in Vorlagenkoordinaten um. */
function zuVorlage(ev) {
  const rect = vorschau.getBoundingClientRect();
  const skalaX = Number(breiteFeld.value) / rect.width;
  const skalaY = Number(hoeheFeld.value) / rect.height;
  return {
    x: Math.round((ev.clientX - rect.left) * skalaX),
    y: Math.round((ev.clientY - rect.top) * skalaY),
  };
}

/** Welches Element liegt an dieser Stelle? Avatar hat Vorrang. */
function elementBei({ x, y }) {
  const a = config.avatar;
  if (a.enabled && x >= a.x && x <= a.x + a.size && y >= a.y && y <= a.y + a.size) {
    return 'avatar';
  }
  for (const block of ['username', 'subtitle']) {
    const b = config[block];
    if (!b.enabled) continue;
    // Grosszügige Trefferfläche rund um die Grundlinie des Textes.
    const halbe = b.size * 0.7;
    const links = b.align === 'center' ? b.x - b.maxWidth / 2 : b.align === 'right' ? b.x - b.maxWidth : b.x;
    if (x >= links && x <= links + b.maxWidth && y >= b.y - halbe && y <= b.y + halbe) {
      return block;
    }
  }
  return null;
}

let ziehen = null;

vorschau.addEventListener('pointerdown', (ev) => {
  const punkt = zuVorlage(ev);
  const ziel = elementBei(punkt);
  if (!ziel) return;

  ziehen = { ziel, versatzX: punkt.x - config[ziel].x, versatzY: punkt.y - config[ziel].y };
  vorschau.setPointerCapture(ev.pointerId);
  ev.preventDefault();
});

vorschau.addEventListener('pointermove', (ev) => {
  if (!ziehen) return;
  const punkt = zuVorlage(ev);
  const x = punkt.x - ziehen.versatzX;
  const y = punkt.y - ziehen.versatzY;

  setzen(`${ziehen.ziel}.x`, x);
  setzen(`${ziehen.ziel}.y`, y);

  // Die Zahlenfelder bleiben die Wahrheitsquelle und werden mitgeführt.
  formular.querySelector(`[data-pfad="${ziehen.ziel}.x"]`).value = x;
  formular.querySelector(`[data-pfad="${ziehen.ziel}.y"]`).value = y;
  vorschauAnfordern();
});

const ziehenBeenden = (ev) => {
  if (!ziehen) return;
  ziehen = null;
  vorschau.releasePointerCapture?.(ev.pointerId);
};
vorschau.addEventListener('pointerup', ziehenBeenden);
vorschau.addEventListener('pointercancel', ziehenBeenden);

/* Beim Absenden das Layout als JSON mitschicken. */
formular.addEventListener('submit', () => {
  configFeld.value = JSON.stringify(config);
});

vorschauLaden();
