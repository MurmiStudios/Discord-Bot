/**
 * Rollenregeln: "Wer Rolle B bekommt, verliert Rolle A."
 *
 * ── Warum das nicht in eine Endlosschleife läuft ────────────────────────────
 * Regeln reagieren ausschliesslich auf HINZUGEFÜGTE Rollen, und die Reaktion
 * ist ausschliesslich ein ENTFERNEN. Löst unser eigenes Entfernen erneut ein
 * guildMemberUpdate aus, ist die Menge der hinzugefügten Rollen leer und die
 * Auswertung endet sofort. Die Rekursion bricht nach genau einem Folgeereignis
 * ab — konstruktionsbedingt, selbst bei widersprüchlichen Regeln
 * ("B entfernt A" und gleichzeitig "A entfernt B"). Es braucht keine
 * Unterdrückungs-Flags und keine Zeitfenster.
 *
 * ── Warum der Diff gegen die Datenbank läuft, nicht gegen oldMember ─────────
 * `oldMember` ist nur zuverlässig, wenn das Mitglied im Cache lag. Nach einem
 * Neustart ist es unvollständig; der Diff würde fälschlich melden, alle Rollen
 * seien gerade hinzugefügt worden — und das löste Massen-Entfernungen aus.
 * Deshalb hält die Tabelle member_roles den massgeblichen Stand.
 */

/**
 * Reine Funktion: Was soll entfernt werden?
 *
 * Bewusst ohne Discord-Zugriff, damit die riskanteste Logik vollständig
 * unit-testbar bleibt.
 *
 * @param {string[]} hinzugefuegt Rollen, die das Mitglied gerade bekommen hat
 * @param {string[]} aktuell      alle Rollen, die es jetzt hat
 * @param {Array<{id:number,triggerRoleId:string,removeRoleIds:string[],enabled:boolean}>} regeln
 * @returns {{entfernen: string[], gruende: Array<{regelId:number,trigger:string,rolle:string}>}}
 */
export function planRemovals(hinzugefuegt, aktuell, regeln) {
  const neu = new Set(hinzugefuegt);
  const bestand = new Set(aktuell);
  const entfernen = new Set();
  const gruende = [];

  for (const regel of regeln) {
    if (!regel.enabled) continue;
    if (!neu.has(regel.triggerRoleId)) continue;

    for (const rolle of regel.removeRoleIds) {
      // Nie eine Rolle entfernen, die gerade erst vergeben wurde. Das schützt
      // gegen selbstbezügliche Regeln ("B entfernt B") und gegen zwei
      // gleichzeitig vergebene Rollen, die sich gegenseitig entfernen würden.
      if (neu.has(rolle)) continue;
      // Rollen, die das Mitglied gar nicht hat, sparen einen API-Aufruf.
      if (!bestand.has(rolle)) continue;
      if (entfernen.has(rolle)) continue;

      entfernen.add(rolle);
      gruende.push({ regelId: regel.id, trigger: regel.triggerRoleId, rolle });
    }
  }

  return { entfernen: [...entfernen], gruende };
}

/**
 * Vergleicht den gespeicherten Stand mit dem aktuellen.
 *
 * @returns {{erstsichtung:boolean, hinzugefuegt:string[], entfernt:string[], geaendert:boolean}}
 */
export function diffRollen(vorher, jetzt) {
  if (vorher === null) {
    return { erstsichtung: true, hinzugefuegt: [], entfernt: [], geaendert: true };
  }
  const alt = new Set(vorher);
  const neu = new Set(jetzt);
  const hinzugefuegt = [...neu].filter((r) => !alt.has(r));
  const entfernt = [...alt].filter((r) => !neu.has(r));
  return {
    erstsichtung: false,
    hinzugefuegt,
    entfernt,
    geaendert: hinzugefuegt.length > 0 || entfernt.length > 0,
  };
}
