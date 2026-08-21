/**
 * Alle Texte der Oberfläche an einer Stelle.
 * Erleichtert einheitliche Formulierungen und eine spätere Übersetzung.
 */
export const de = {
  app: {
    titel: 'Discord-Panel',
    abmelden: 'Abmelden',
    anmelden: 'Mit Discord anmelden',
    speichern: 'Speichern',
    abbrechen: 'Abbrechen',
    loeschen: 'Löschen',
    senden: 'Senden',
    neu: 'Neu',
    bearbeiten: 'Bearbeiten',
    zurueck: 'Zurück',
    keineDaten: 'Noch nichts vorhanden.',
    bestaetigen: 'Wirklich löschen?',
  },
  nav: {
    dashboard: 'Übersicht',
    dm: 'Direktnachricht',
    channels: 'Kanal-Nachricht',
    roleMessages: 'Rollen-Nachrichten',
    roleRules: 'Rollenregeln',
    templates: 'Bildvorlagen',
    buttonSets: 'Aktionsleisten',
    welcome: 'Willkommensnachricht',
    logs: 'Protokoll',
  },
  status: {
    ok: 'Zugestellt',
    failed: 'Fehlgeschlagen',
    skipped: 'Übersprungen',
  },
  logKind: {
    dm: 'Direktnachricht',
    role_dm: 'Rollen-Nachricht',
    welcome_dm: 'Willkommensnachricht',
    channel: 'Kanal-Nachricht',
    button: 'Button-Klick',
    rule_applied: 'Rollenregel',
    auth: 'Anmeldung',
    error: 'Fehler',
  },
  platzhalter: {
    titel: 'Verfügbare Platzhalter',
    user: 'Anzeigename des Empfängers',
    tag: 'Discord-Benutzername',
    guild: 'Name des Servers',
    role: 'Name der Rolle',
    count: 'Mitgliederzahl',
  },
};

/** Versandarten — dort passt „Zugestellt“, sonst ist es irreführend. */
const VERSANDARTEN = new Set(['dm', 'role_dm', 'welcome_dm', 'channel']);

/**
 * Statusbezeichnung passend zur Art des Vorgangs. Eine angewandte Rollenregel
 * wurde nicht „zugestellt“, sondern schlicht ausgeführt.
 */
export function statusText(status, kind) {
  if (status === 'ok') return VERSANDARTEN.has(kind) ? 'Zugestellt' : 'Erfolgreich';
  return de.status[status] ?? status;
}

/** Zugriff über Punktpfad, z. B. t('nav.dashboard'). */
export function t(pfad, fallback = '') {
  return pfad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), de) ?? fallback ?? pfad;
}

export default de;
