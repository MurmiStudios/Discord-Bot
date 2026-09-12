# Discord-Panel

Ein Discord-Bot mit Webpanel, das **du selbst betreibst** (auf deinem eigenen
Computer oder einem Server) — kein fremder Dienst, keine Abo-Gebühr, keine
Weitergabe deiner Daten. Über das Panel verschickst du Nachrichten an
Mitglieder oder Kanäle, richtest automatische Willkommensnachrichten und
Rollen-Automatiken ein, baust Buttons mit Aktionen und personalisierte
Bilder. Die Anmeldung im Panel läuft über dein Discord-Konto, es gibt kein
separates Passwort zum Merken.

Diese Anleitung geht davon aus, dass du **noch nie** einen Discord-Bot
erstellt hast. Jeder Schritt ist einzeln beschrieben — einfach von oben nach
unten durcharbeiten. Plane etwa 15–20 Minuten ein.

---

## Was du brauchst, bevor du anfängst

- [ ] Einen Computer (Windows, Mac oder Linux)
- [ ] Ein Discord-Konto
- [ ] Adminrechte auf dem Discord-Server, auf dem der Bot laufen soll
- [ ] Diesen Projektordner auf deinem Computer (der, in dem auch diese
      Datei liegt)

---

## Schritt 1 — Node.js installieren

Node.js ist die Software, die dieses Programm ausführt. Falls du nicht
weißt, ob sie schon installiert ist, gehe einfach direkt zu **„Prüfen“**
weiter unten — falls sie fehlt oder zu alt ist, merkst du es dort.

**Windows:**
1. Öffne https://nodejs.org im Browser.
2. Lade die Version herunter, die dort als **„LTS“** markiert ist (der grüne
   Knopf).
3. Öffne die heruntergeladene Datei und klicke dich mit „Weiter“ /
   „Next“ durch die Installation (Standardeinstellungen sind in Ordnung).

**Mac:**
1. Öffne https://nodejs.org im Browser, lade die **LTS**-Version herunter
   und installiere sie wie gewohnt (Doppelklick auf die `.pkg`-Datei,
   durchklicken).
   - Falls du [Homebrew](https://brew.sh) installiert hast, geht es auch mit
     `brew install node` im Terminal.

**Linux:**
- Am einfachsten über [nvm](https://github.com/nvm-sh/nvm#installing-and-updating):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  nvm install --lts
  ```
- Oder über den Paketmanager deiner Distribution (z. B. `sudo apt install nodejs npm`),
  dort ist die Version aber oft zu alt — im Zweifel nvm verwenden.

**Prüfen:** Öffne ein Terminal-Fenster (siehe Kasten unten, falls du nicht
weißt, was das ist) und tippe:

```bash
node -v
```

Es sollte etwas wie `v22.5.0` oder höher erscheinen. Steht dort eine
niedrigere Nummer oder eine Fehlermeldung, installiere Node.js wie oben
beschrieben (neu) und starte das Terminal-Fenster danach neu.

<details>
<summary>Was ist ein „Terminal“ und wie öffne ich eins?</summary>

Das Terminal ist ein Fenster, in dem du Befehle eintippst statt zu klicken.

- **Windows:** Windows-Taste drücken, „PowerShell“ eintippen, Enter.
- **Mac:** `cmd + Leertaste`, „Terminal“ eintippen, Enter.
- **Linux:** meist `Strg + Alt + T`, oder im Anwendungsmenü nach „Terminal“
  suchen.

Ein Befehl wie `node -v` wird eingetippt und mit Enter bestätigt.
</details>

---

## Schritt 2 — Terminal im Projektordner öffnen

Alle folgenden Befehle müssen **in diesem Projektordner** ausgeführt werden
(dem Ordner, in dem diese README-Datei liegt).

**Windows:** Öffne den Ordner im Explorer, halte `Umschalt` gedrückt,
Rechtsklick auf eine leere Stelle im Ordner → „PowerShell-Fenster hier
öffnen“ (oder „In Terminal öffnen“).

**Mac:** Öffne den Ordner im Finder, Rechtsklick auf eine leere Stelle →
„Neues Terminal am Ordner“. Falls diese Option fehlt: Terminal öffnen und
`cd ` eintippen (mit Leerzeichen danach), den Ordner aus dem Finder ins
Terminal-Fenster ziehen, Enter drücken.

**Linux:** Meist Rechtsklick im Dateimanager → „Im Terminal öffnen“.

Zum Prüfen, ob du im richtigen Ordner bist, tippe `ls` (Mac/Linux) oder
`dir` (Windows) — es sollte u. a. eine Datei namens `package.json` aufgelistet
werden.

---

## Schritt 3 — Discord-Bot anlegen

Hier erstellst du die „Blaupause“ deines Bots bei Discord selbst. Halte
einen Texteditor (z. B. Notizen-App) griffbereit, um zwei Werte
zwischenzuspeichern.

1. Öffne https://discord.com/developers/applications und melde dich mit
   deinem Discord-Konto an, falls nötig.
2. Klicke oben rechts auf **„New Application“**.
3. Gib einen Namen ein (z. B. wie dein Bot später heißen soll) und klicke
   **„Create“**.
4. Klicke in der Seitenleiste links auf **„Bot“**.
5. Klicke auf **„Reset Token“**, bestätige die Sicherheitsabfrage, und
   klicke danach auf **„Copy“**.
   → Füge das kopierte **Bot-Token** in deinen Texteditor ein.
   ⚠️ Dieses Token ist geheim wie ein Passwort — niemandem zeigen und nicht
   veröffentlichen. Es steuert deinen Bot vollständig.
6. Scrolle auf derselben Seite weiter nach unten bis **„Privileged Gateway
   Intents“**. Schalte **„SERVER MEMBERS INTENT“** ein (Schalter wird grün).
   Klicke, falls vorhanden, unten auf **„Save Changes“**.
   → Ohne diesen Schalter bekommt der Bot nicht mit, wenn jemand dem Server
   beitritt oder eine Rolle wechselt — Willkommensnachricht und
   Rollen-Automatiken würden nicht funktionieren.
7. Klicke in der Seitenleiste links auf **„OAuth2“**.
8. Unter **„Client Secret“** klicke auf **„Reset Secret“** (falls dort
   schon etwas steht) und bestätige, dann auf **„Copy“**.
   → Füge das kopierte **Client Secret** ebenfalls in deinen Texteditor ein.

Du hast jetzt zwei Werte notiert: **Bot-Token** und **Client Secret**. Die
Seite mit der Discord-Anwendung kannst du offen lassen, du brauchst sie
gleich noch einmal kurz.

---

## Schritt 4 — Deine Server-ID herausfinden

1. Öffne Discord (die App oder https://discord.com im Browser).
2. Klicke auf das Zahnrad-Symbol unten links (**Benutzereinstellungen**).
3. Klicke links auf **„Erweitert“** (Advanced).
4. Schalte **„Entwicklermodus“** (Developer Mode) ein.
5. Schließe die Einstellungen wieder.
6. Rechtsklicke in der linken Serverleiste auf das **Icon des Servers**,
   auf dem der Bot laufen soll.
7. Klicke im Menü auf **„ID kopieren“** (Copy Server ID).
   → Füge diese **Server-ID** ebenfalls in deinen Texteditor ein.

---

## Schritt 5 — Einrichtung starten

Zurück im Terminal-Fenster aus Schritt 2, tippe:

```bash
npm run setup
```

und drücke Enter. Das dauert beim ersten Mal ein bis zwei Minuten (es
werden Programmpakete heruntergeladen), danach stellt dir das Skript ein
paar Fragen. Hier ist **genau**, was kommt und was du eintippst:

| Das Skript fragt … | Was du eingibst |
|---|---|
| `Bot-Token:` | Das Token aus Schritt 3.5 einfügen, Enter |
| `Client-Secret:` | Das Secret aus Schritt 3.8 einfügen, Enter |
| `Server-ID (…):` | Die ID aus Schritt 4.7 einfügen, Enter |
| `Basis-URL (…):` | Einfach Enter drücken (übernimmt die Vorgabe) |
| `Weiter mit Enter, sobald eingetragen … ` | Siehe Kasten unten, dann Enter |
| `Deine Discord-User-ID für festen Admin-Zugriff (…):` | **Einfach Enter drücken, leer lassen** |
| `Panel jetzt starten? (J/n)` | Enter drücken (startet das Panel) |

Bei zwei Fragen kann eine Zwischenmeldung kommen:

- **„✗ Der Bot ist nicht auf diesem Server“** — das Skript zeigt dir
  darunter einen Link. Öffne ihn im Browser, wähle deinen Server aus,
  klicke **„Authorize“**/„Autorisieren“, kehre zum Terminal zurück und
  drücke Enter.
- **„Trage im Developer-Portal unter OAuth2 → Redirects genau diese
  Adresse ein: …“** — gehe zurück zur Discord-Anwendungsseite aus Schritt 3
  (Reiter **OAuth2**), klicke bei **„Redirects“** auf **„Add Redirect“**,
  füge die im Terminal angezeigte Adresse ein und klicke **„Save Changes“**.
  Dann zurück im Terminal Enter drücken.

Zur letzten Frage, der Admin-ID: **leer lassen ist hier bewusst richtig.**
Dadurch wird automatisch die erste Person mit Server-Administrator-Rechten,
die sich gleich im Panel anmeldet — also du — zum Panel-Administrator.

---

## Schritt 6 — Anmelden

Wenn du die letzte Frage mit Enter bestätigt hast, startet das Panel. Das
Terminal-Fenster zeigt zuletzt eine Zeile wie:

```
[web] Panel läuft auf http://localhost:3000
```

1. Öffne im Browser: **http://localhost:3000**
2. Klicke auf **„Mit Discord anmelden“**.
3. Bestätige bei Discord (falls gefragt) mit **„Autorisieren“**.

Du landest in der Übersicht des Panels — fertig! Von hier aus lässt sich
alles über die Navigation oben bedienen (Nachricht senden, Willkommen,
Rollen-Automatiken, Aktionsleisten, Bildvorlagen, Protokoll).

**Wichtig:** Das Terminal-Fenster muss offen und der Befehl darin am
Laufen bleiben, solange du das Panel benutzen willst — es ist der Server,
der Panel und Bot betreibt. Schließt du das Fenster, geht der Bot offline.

---

## Danach: starten, stoppen, aktualisieren

- **Bot/Panel stoppen:** im Terminal-Fenster `Strg + C` drücken (Mac: `cmd + C`
  funktioniert nicht, es ist auch dort `Strg (Control) + C`).
- **Später wieder starten:** Terminal im Projektordner öffnen (Schritt 2),
  dann:
  ```bash
  npm start
  ```
- **Einstellungen ändern** (z. B. anderer Bot, andere Adresse):
  ```bash
  npm run setup
  ```
  erneut ausführen — bereits eingetragene Werte werden als Vorschlag
  angezeigt, du kannst sie mit Enter übernehmen oder überschreiben.

---

## Problembehandlung

**„Node.js … gefunden, mindestens 22.5 wird gebraucht“**
→ Node.js ist zu alt. Neu installieren wie in Schritt 1 beschrieben, dann
Terminal-Fenster schließen und neu öffnen.

**„Token ungültig oder Discord nicht erreichbar“**
→ Prüfe, ob du das Token vollständig (ohne Leerzeichen davor/danach)
eingefügt hast. Falls unsicher: zurück zur Discord-Anwendung → Bot → erneut
„Reset Token“ klicken, frisch kopieren, im Setup-Skript neu eingeben.

**„Der Bot ist nicht auf diesem Server (oder die ID ist falsch)“**
→ Entweder die Server-ID ist falsch abgetippt (Schritt 4 wiederholen),
oder der Bot muss noch über den angezeigten Link eingeladen werden.

**Im Browser erscheint „Kein Zugriff“ nach der Anmeldung**
→ Du hast dich mit einem Discord-Konto angemeldet, das auf dem Server keine
Administrator-Rechte hat und auch nicht in `PANEL_ADMIN_IDS` steht. Melde
dich stattdessen mit einem Konto an, das auf dem Server unter
„Servereinstellungen → Rollen“ die Berechtigung **Administrator** hat.

**Etwas anderes belegt bereits Port 3000 / „EADDRINUSE“**
→ Öffne die Datei `.env` im Projektordner mit einem Texteditor, ändere die
Zeile `PORT=3000` auf z. B. `PORT=3001`, speichere, starte mit `npm start`
neu und rufe im Browser `http://localhost:3001` auf.

**Ich will von vorne anfangen**
→ Lösche die Datei `.env` im Projektordner und führe `npm run setup` erneut
aus.

---

## Für Fortgeschrittene / Referenz

Der Rest dieser Datei ist keine Einrichtungsanleitung mehr, sondern
Hintergrundwissen für alle, die tiefer einsteigen oder das Projekt
weiterentwickeln wollen.

### Zugriffsstufen im Detail

Es gibt kein separates Panel-Passwort. Wer sich mit Discord anmeldet, sieht
das Panel, wenn er:

- in `PANEL_ADMIN_IDS` (in `.env`) steht (**Panel-Administrator**), oder
- **`PANEL_ADMIN_IDS` ist leer UND er ist die erste Person mit der
  Discord-Berechtigung „Administrator“ auf dem Server, die sich je angemeldet
  hat** — wird dann dauerhaft Panel-Administrator (in der Datenbank
  vermerkt, kein Wettlauf bei jedem Neustart). Bewusst auf
  Server-Administratoren beschränkt, damit nicht irgendjemand mit einem
  beliebigen Discord-Konto die Anmeldeseite vor dir aufrufen und sich selbst
  Zugriff verschaffen kann, oder
- auf dem Server die Berechtigung „Administrator“ hat und
  `PANEL_SERVER_ADMIN_ACCESS=1` gesetzt ist (**Server-Administrator**), oder
- eine Rolle aus `PANEL_ALLOWED_ROLE_IDS` hat (**berechtigte Rolle**).

Alle anderen sehen eine Erklärung statt der Seite. Wer den Server verlässt,
verliert den Zugriff spätestens 5 Minuten später (der Cache-Zeitraum, nach
dem die Mitgliedschaft erneut geprüft wird).

### Manuelle Einrichtung statt `npm run setup`

Falls du lieber alles von Hand einträgst: `cp .env.example .env`, die Werte
aus den Schritten 3–4 oben plus einen zufälligen `SESSION_SECRET`
(z. B. `openssl rand -hex 32`) eintragen, dann `npm install && npm start`.

### Hinter einem Reverse-Proxy (HTTPS)

`TRUST_PROXY=1` in `.env` setzen, sonst bricht der Start mit einer
benannten Meldung ab (das Sitzungs-Cookie würde sonst nie als `Secure`
gesendet).

### Projektstruktur

```
src/
  config.js          Einlesen & Prüfen der Umgebungsvariablen
  db/                 SQLite-Schema und Datenzugriff (node:sqlite)
  discord/            Bot-Client, Event-Handler, Nachrichten-/Bild-Renderer
  web/                Express-App: Routen, Ansichten (EJS), CSS/JS
assets/fonts/         Mitgelieferte Schrift für die Bildvorlagen (SIL OFL)
scripts/setup.js               Interaktive Einrichtung, siehe `npm run setup`
scripts/render-smoke-test.js   Rendert jede Ansicht einmal mit Beispieldaten
                                (node scripts/render-smoke-test.js) — nützlich
                                nach Änderungen an den .ejs-Dateien
```

### Was bewusst vereinfacht wurde

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
