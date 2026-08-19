/**
 * Warteschlange für Massenversand.
 *
 * Zwei Gründe: Discords Rate-Limits sollen nicht ausgereizt werden, und eine
 * HTTP-Anfrage darf nicht minutenlang offen bleiben, während 200 DMs
 * rausgehen. Der Auftrag läuft im Hintergrund, das Panel fragt den Stand ab.
 */
import { randomUUID } from 'node:crypto';

const auftraege = new Map();
// Abgeschlossene Aufträge nach einer Weile aufräumen, damit der Speicher
// bei langem Betrieb nicht unbegrenzt wächst.
const AUFBEWAHRUNG_MS = 30 * 60 * 1000;

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Startet einen Auftrag und gibt sofort dessen ID zurück.
 *
 * @param {Array<any>} elemente
 * @param {(element:any, index:number) => Promise<{ok:boolean, grund?:string, label?:string}>} arbeit
 * @param {{delayMs?:number, titel?:string}} optionen
 */
export function starteAuftrag(elemente, arbeit, { delayMs = 1500, titel = '' } = {}) {
  const id = randomUUID();
  const auftrag = {
    id,
    titel,
    gesamt: elemente.length,
    erledigt: 0,
    erfolg: 0,
    fehler: 0,
    fertig: false,
    gestartet: Date.now(),
    ergebnisse: [],
  };
  auftraege.set(id, auftrag);

  (async () => {
    for (let i = 0; i < elemente.length; i += 1) {
      let ergebnis;
      try {
        ergebnis = await arbeit(elemente[i], i);
      } catch (err) {
        // Ein unerwarteter Fehler darf den restlichen Versand nicht abbrechen.
        ergebnis = { ok: false, grund: err?.message ?? 'Unerwarteter Fehler' };
      }
      auftrag.ergebnisse.push({ ...ergebnis, index: i });
      auftrag.erledigt += 1;
      if (ergebnis.ok) auftrag.erfolg += 1;
      else auftrag.fehler += 1;

      if (delayMs > 0 && i < elemente.length - 1) await warte(delayMs);
    }
    auftrag.fertig = true;
    auftrag.beendet = Date.now();
    setTimeout(() => auftraege.delete(id), AUFBEWAHRUNG_MS).unref?.();
  })();

  return id;
}

export function holeAuftrag(id) {
  return auftraege.get(id) ?? null;
}

export function alleAuftraege() {
  return [...auftraege.values()].sort((a, b) => b.gestartet - a.gestartet);
}
