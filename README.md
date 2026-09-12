# Discord-Panel

Ein selbst gehosteter Discord-Bot mit Webpanel: Nachrichten an Mitglieder oder
Kanäle senden, Willkommens- und Rollen-Automatiken, wiederverwendbare
Aktionsleisten (Buttons) und personalisierte Bildvorlagen. Anmeldung im
Panel läuft über Discord-OAuth2, kein eigenes Passwort.

## Voraussetzungen

- Node.js **22.5 oder neuer** (verwendet das eingebaute `node:sqlite` —
  keine native Kompilierung nötig, `npm install` läuft überall ohne Build-Tools)
- Ein Discord-Server, auf dem du Administratorrechte hast

## 1. Discord-Anwendung anlegen

1. Auf https://discord.com/developers/applications eine neue Anwendung anlegen.
2. Unter **Bot**: einen Bot hinzufügen, das Bot-Token kopieren
   (`DISCORD_BOT_TOKEN`). Unter **Privileged Gateway Intents** die
   **Server Members Intent** einschalten — ohne sie sehen Willkommen,
   Rollen-Nachrichten und Rollenregeln niemanden beitreten oder Rollen wechseln.
3. Unter **OAuth2 → General**: Client-ID (`DISCORD_CLIENT_ID`) und Client-Secret
   (`DISCORD_CLIENT_SECRET`) kopieren. Als Redirect einen Eintrag hinzufügen,
   der exakt `DISCORD_REDIRECT_URI` entspricht, z. B.
   `http://localhost:3000/auth/callback`.
4. Unter **OAuth2 → URL Generator**: Scope `bot` wählen, Berechtigungen
   mindestens `Send Messages`, `View Channels`, `Manage Roles`,
   `Kick Members` (falls die Kick-Aktion genutzt wird). Die erzeugte URL
   öffnen und den Bot auf den Server einladen. Seine Rolle muss über jeder
   Rolle stehen, die er vergeben/entfernen soll.
5. Die Server-ID (Rechtsklick auf den Server, „ID kopieren“, dafür
   Entwicklermodus in den Discord-Einstellungen aktivieren) als
   `DISCORD_GUILD_ID` eintragen.

## 2. Einrichten

```bash
cp .env.example .env
# .env ausfüllen: DISCORD_*, SESSION_SECRET (z. B. `openssl rand -hex 32`),
# PANEL_ADMIN_IDS (deine eigene Discord-User-ID, damit du dich anmelden kannst)
npm install
npm start
```

Das Panel läuft danach auf `http://localhost:3000`. Beim ersten Start legt es
`data/panel.sqlite` selbst an (Nachrichten, Vorlagen, Protokoll, Sitzungen —
alles in einer Datei, ein Neustart wirft niemanden aus der Sitzung).

Für die Entwicklung mit automatischem Neustart: `npm run dev`
(benötigt `nodemon`, in den devDependencies enthalten).

### Hinter einem Reverse-Proxy (HTTPS)

`TRUST_PROXY=1` setzen, sonst bricht der Start mit einer benannten Meldung
ab (das Sitzungs-Cookie würde sonst nie als `Secure` gesendet).

## Zugriffsstufen

Es gibt kein separates Panel-Passwort. Wer sich mit Discord anmeldet, sieht
das Panel, wenn er:

- in `PANEL_ADMIN_IDS` steht (**Panel-Administrator**), oder
- auf dem Server die Berechtigung „Administrator“ hat und
  `PANEL_SERVER_ADMIN_ACCESS=1` gesetzt ist (**Server-Administrator**), oder
- eine Rolle aus `PANEL_ALLOWED_ROLE_IDS` hat (**berechtigte Rolle**).

Alle anderen sehen eine Erklärung statt der Seite. Wer den Server verlässt,
verliert den Zugriff spätestens 5 Minuten später (der Cache-Zeitraum, nach
dem die Mitgliedschaft erneut geprüft wird).

## Projektstruktur

```
src/
  config.js          Einlesen & Prüfen der Umgebungsvariablen
  db/                 SQLite-Schema und Datenzugriff (node:sqlite)
  discord/            Bot-Client, Event-Handler, Nachrichten-/Bild-Renderer
  web/                Express-App: Routen, Ansichten (EJS), CSS/JS
assets/fonts/         Mitgelieferte Schrift für die Bildvorlagen (SIL OFL)
scripts/render-smoke-test.js   Rendert jede Ansicht einmal mit Beispieldaten
                                (node scripts/render-smoke-test.js) — nützlich
                                nach Änderungen an den .ejs-Dateien
```

## Was bewusst vereinfacht wurde

Ehrlich benannt, statt still verschwiegen:

- **Aktionsleisten-Buttons führen genau eine Aktion aus**, nicht eine Kette
  mehrerer Aktionen. Der Bot-seitige Code (`src/discord/events/interactionCreate.js`)
  ist bereits auf Ketten ausgelegt (`button.actions` ist ein Array) — es fehlt
  nur die UI, um mehr als eine Aktion pro Button anzulegen.
- **DM-Aktionen von Buttons verschicken nur Text**, kein eigenes Embed oder
  Bild (das würde das Formular pro Button auf zehn Buttons vervielfacht
  sprengen). Die Datenstruktur erlaubt es, die UI müsste dafür erweitert werden.
- **Embed-Felder, Textzeilen der Bildvorlage und Aktionsleisten-Buttons sind
  auf eine feste Zahl Formularzeilen begrenzt** (5 Embed-Felder, 4 Textzeilen,
  10 Buttons) statt beliebig per JavaScript nachladbar — damit die Formulare
  auch ganz ohne JavaScript funktionieren.
- **Kein Ziehen mit der Maus im Bildvorschau-Editor.** Position von Profilbild
  und Textzeilen wird über Zahlenfelder (X/Y) eingestellt statt per Drag —
  funktional gleichwertig, aber ohne die Maus-Interaktion.
- **Massenversand an eine ganze Rolle** (Rollen-Nachrichten → „Jetzt an alle
  senden“) läuft synchron durch und zeigt das Ergebnis erst danach an, statt
  live mitzuzählen. Der Einzel-/Mehrfachversand über die Nachrichtenseite hat
  dagegen eine Live-Fortschrittsanzeige.
- **Kein Bestätigungsdialog direkt in Discord** vor dem Kick eines Mitglieds
  über einen Button — die Warnung erscheint im Panel beim Einrichten des
  Buttons (fehlende Berechtigung), nicht als zweiter Klick in Discord selbst.
- **CSV-Export der Rückmeldungen** enthält keine deutsche Locale-Formatierung
  für Zahlen o. Ä. — reines UTF-8-CSV mit BOM für Excel.

Alles andere aus der Funktionsliste ist eingebaut: OAuth2-Anmeldung mit vier
Zugriffsstufen, CSRF-Schutz, Ratenbegrenzung, strikte CSP ohne Inline-Code,
serverseitige Berechtigungsprüfung vor jeder Discord-Aktion, Sitzung in der
Datenbank, geprüfte Uploads, vollständiges Protokoll.
