# Discord-Panel

Ein Discord-Bot mit Webpanel, den **du selbst auf deinem eigenen
Linux-Server betreibst** — kein fremder Dienst, keine Abo-Gebühr, keine
Weitergabe deiner Daten. Läuft dauerhaft im Hintergrund (als systemd-Dienst)
und startet nach einem Server-Neustart automatisch neu. Über das Panel
verschickst du Nachrichten an Mitglieder oder Kanäle, richtest automatische
Willkommensnachrichten und Rollen-Automatiken ein, baust Buttons mit
Aktionen und personalisierte Bilder. Die Anmeldung im Panel läuft über dein
Discord-Konto, es gibt kein separates Passwort zum Merken.

Diese Anleitung geht davon aus, dass du **noch nie** einen Discord-Bot
erstellt hast, aber schon einmal per SSH auf einem Server warst. Jeder
Schritt ist einzeln beschrieben — einfach von oben nach unten
durcharbeiten. Plane etwa 20–30 Minuten ein.

**Nur Linux wird unterstützt** (getestet mit Ubuntu/Debian). Andere
Distributionen funktionieren meist auch, nur die automatische Installation
von Node.js und Caddy in Schritt 2 und 6 ist auf `apt` zugeschnitten.

---

## Was du brauchst, bevor du anfängst

- [ ] Einen Linux-Server mit SSH-Zugang, auf dem du `sudo`-Rechte hast
      (ein eigener VPS/Root-Server reicht, ab den günstigsten Angeboten)
- [ ] Ein Discord-Konto mit Administratorrechten auf dem Discord-Server,
      auf dem der Bot laufen soll
- [ ] Optional, aber empfohlen: eine **Domain**, die du auf die IP-Adresse
      deines Servers zeigen lassen kannst (für automatisches HTTPS). Ohne
      Domain funktioniert es auch, siehe Schritt 6.

---

## Schritt 1 — Mit dem Server verbinden

Von deinem eigenen Computer aus (Terminal auf Mac/Linux, PowerShell oder
[WSL](https://learn.microsoft.com/windows/wsl/install) unter Windows):

```bash
ssh dein-benutzer@deine-server-ip
```

Die genauen Zugangsdaten bekommst du von deinem Hosting-Anbieter. Alle
folgenden Befehle werden **auf dem Server** eingegeben, also in diesem
SSH-Fenster.

---

## Schritt 2 — Node.js installieren

Node.js ist die Software, die dieses Programm ausführt.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

(Nutzt du keine Debian/Ubuntu-Distribution, installiere Node.js **22 oder
neuer** über den Weg, der für deine Distribution üblich ist, z. B.
[nvm](https://github.com/nvm-sh/nvm#installing-and-updating).)

**Prüfen:**

```bash
node -v
```

Es sollte `v22.5.0` oder höher erscheinen.

---

## Schritt 3 — Projekt auf den Server holen

```bash
git clone https://github.com/MurmiStudios/Discord-Bot.git
cd Discord-Bot
```

(Ist das Repository privat, fragt `git clone` nach Zugangsdaten — dann
stattdessen [einen Personal Access Token verwenden](https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
oder das Projekt per `scp -r` von deinem Rechner auf den Server kopieren.)

Alle weiteren Befehle werden **in diesem Ordner** ausgeführt.

---

## Schritt 4 — Discord-Bot anlegen

Diesen Schritt machst du **in einem Browser** — auf dem Server, deinem
eigenen Rechner oder Handy, das ist egal. Halte einen Texteditor (z. B.
Notizen-App) griffbereit, um zwei Werte zwischenzuspeichern.

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

## Schritt 5 — Deine Server-ID herausfinden

Auch das machst du in Discord selbst (App oder https://discord.com im
Browser), nicht auf dem Linux-Server:

1. Klicke auf das Zahnrad-Symbol unten links (**Benutzereinstellungen**).
2. Klicke links auf **„Erweitert“** (Advanced).
3. Schalte **„Entwicklermodus“** (Developer Mode) ein.
4. Schließe die Einstellungen wieder.
5. Rechtsklicke in der linken Serverleiste auf das **Icon des Servers**,
   auf dem der Bot laufen soll.
6. Klicke im Menü auf **„ID kopieren“** (Copy Server ID).
   → Füge diese **Server-ID** ebenfalls in deinen Texteditor ein.

Falls du eine Domain für den Server einrichten willst (empfohlen, siehe
nächster Schritt): stelle jetzt schon einen DNS-**A-Record** dieser Domain
auf die IP-Adresse deines Servers — das kann ein paar Minuten bis Stunden
dauern, bis es wirkt, du kannst mit Schritt 6 aber trotzdem sofort
weitermachen.

---

## Schritt 6 — Einrichtung starten

Zurück im SSH-Fenster auf dem Server, im Projektordner aus Schritt 3,
tippe:

```bash
npm run setup
```

Das dauert beim ersten Mal ein bis zwei Minuten (Programmpakete werden
heruntergeladen), danach stellt dir das Skript ein paar Fragen. Hier ist
**genau**, was kommt und was du eintippst:

| Das Skript fragt … | Was du eingibst |
|---|---|
| `Bot-Token:` | Das Token aus Schritt 4.5 einfügen, Enter |
| `Client-Secret:` | Das Secret aus Schritt 4.8 einfügen, Enter |
| `Server-ID (…):` | Die ID aus Schritt 5.6 einfügen, Enter |
| `Auswahl (1/2/3):` | Siehe „Erreichbarkeit wählen“ unten |
| `Weiter mit Enter, sobald eingetragen … ` | Siehe Kasten unten, dann Enter |
| `Deine Discord-User-ID für festen Admin-Zugriff (…):` | **Einfach Enter drücken, leer lassen** |
| `Als systemd-Dienst einrichten … ?` | Enter drücken (empfohlen: Ja) |
| `Panel jetzt im Vordergrund starten …?` | Erscheint nur, falls kein Dienst eingerichtet wurde |

Zwischendurch können Meldungen erscheinen:

- **„✗ Der Bot ist nicht auf diesem Server“** — das Skript zeigt dir
  darunter einen Link. Öffne ihn in einem Browser (egal auf welchem
  Gerät), wähle deinen Server aus, klicke **„Authorize“**/„Autorisieren“,
  kehre zum SSH-Fenster zurück und drücke Enter.
- Bei der sudo-Installation von Caddy oder beim Einrichten des Dienstes
  kann dich das System nach deinem **sudo-Passwort** fragen — normal
  eingeben, es wird nicht sichtbar getippt.

### Erreichbarkeit wählen

Bei `Auswahl (1/2/3)` fragt das Skript, wie das Panel später erreichbar
sein soll:

1. **Nur lokal auf diesem Server** — zum Testen, erreichbar nur per
   [SSH-Tunnel](#problembehandlung) von deinem eigenen Rechner. Kein
   HTTPS nötig, aber auch nicht bequem für den Alltag.
2. **Über eine Domain, automatisches HTTPS** (empfohlen) — braucht die
   Domain aus Schritt 5. Das Skript installiert dafür **Caddy** als
   Reverse-Proxy, der sich selbständig ein gültiges HTTPS-Zertifikat
   besorgt (Let's Encrypt) und erneuert. Danach ist das Panel unter
   `https://deine-domain` erreichbar.
3. **Direkt über die Server-IP, ohne HTTPS** — nur falls 1 und 2 nicht
   infrage kommen. Anmeldedaten würden dabei unverschlüsselt übertragen;
   nur in einem vertrauenswürdigen Netz sinnvoll.

Bei Option 2 fragt das Skript zusätzlich nach der Domain und kümmert sich
danach selbständig um Installation und Konfiguration von Caddy sowie (falls
eine aktive Firewall erkannt wird) um die Freigabe der Ports 80/443.

Zur Frage nach der Admin-ID: **leer lassen ist bewusst richtig.** Dadurch
wird automatisch die erste Person mit Server-Administrator-Rechten, die
sich gleich im Panel anmeldet — also du — zum Panel-Administrator.

---

## Schritt 7 — Anmelden

Sobald die Einrichtung fertig ist und der systemd-Dienst läuft (das Skript
bestätigt das mit „✓ Dienst „discord-panel“ läuft …“):

1. Öffne im Browser die Adresse, die das Skript am Ende anzeigt
   (`https://deine-domain`, oder bei lokalem Test `http://localhost:3000`
   über einen [SSH-Tunnel](#problembehandlung)).
2. Klicke auf **„Mit Discord anmelden“**.
3. Bestätige bei Discord (falls gefragt) mit **„Autorisieren“**.

Du landest in der Übersicht des Panels — fertig! Von hier aus lässt sich
alles über die Navigation oben bedienen (Nachricht senden, Willkommen,
Rollen-Automatiken, Aktionsleisten, Bildvorlagen, Protokoll).

---

## Danach: den Dienst verwalten

Läuft das Panel als systemd-Dienst (Standardfall), brauchst du kein offenes
SSH-Fenster mehr — es läuft im Hintergrund weiter und startet nach einem
Server-Neustart von selbst neu.

```bash
sudo systemctl status discord-panel     # Läuft er gerade?
sudo journalctl -u discord-panel -f     # Live-Logs ansehen (Strg+C zum Beenden)
sudo systemctl restart discord-panel    # Neu starten (z. B. nach .env-Änderung)
sudo systemctl stop discord-panel       # Anhalten
```

**Einstellungen später ändern** (z. B. andere Domain, anderer Bot):

```bash
npm run setup
```

erneut ausführen — bereits eingetragene Werte werden als Vorschlag
angezeigt, du kannst sie mit Enter übernehmen oder überschreiben. Danach
den Dienst neu starten (`sudo systemctl restart discord-panel`), falls das
Skript ihn nicht schon selbst neu gestartet hat.

**Projekt aktualisieren**, wenn es neue Änderungen im Repository gibt:

```bash
cd Discord-Bot
git pull
npm install
sudo systemctl restart discord-panel
```

---

## Problembehandlung

**„Node.js … gefunden, mindestens 22.5 wird gebraucht“**
→ Node.js ist zu alt. Schritt 2 erneut ausführen.

**„Token ungültig oder Discord nicht erreichbar“**
→ Prüfe, ob du das Token vollständig (ohne Leerzeichen davor/danach)
eingefügt hast. Falls unsicher: zurück zur Discord-Anwendung → Bot → erneut
„Reset Token“ klicken, frisch kopieren, im Setup-Skript neu eingeben.

**„Der Bot ist nicht auf diesem Server (oder die ID ist falsch)“**
→ Entweder die Server-ID ist falsch abgetippt (Schritt 5 wiederholen),
oder der Bot muss noch über den angezeigten Link eingeladen werden.

**Im Browser erscheint „Kein Zugriff“ nach der Anmeldung**
→ Du hast dich mit einem Discord-Konto angemeldet, das auf dem Server keine
Administrator-Rechte hat und auch nicht in `PANEL_ADMIN_IDS` steht. Melde
dich stattdessen mit einem Konto an, das auf dem Server unter
„Servereinstellungen → Rollen“ die Berechtigung **Administrator** hat.

**Die Domain zeigt „Verbindung nicht möglich“ / kein Zertifikat**
→ DNS braucht manchmal etwas Zeit. Prüfen mit `dig +short deine-domain`
(sollte die Server-IP zeigen) und Caddys Logs ansehen:
`sudo journalctl -u caddy -f`. Zeigt die IP noch nicht auf den Server,
etwas warten und Caddy danach neu starten: `sudo systemctl restart caddy`.

**`sudo systemctl status discord-panel` zeigt „failed“**
→ Logs ansehen: `sudo journalctl -u discord-panel -n 50`. Häufigster Grund:
etwas belegt bereits den Port, oder eine Umgebungsvariable in `.env` fehlt
— `.env` mit einem Texteditor prüfen oder `npm run setup` erneut ausführen.

**Etwas anderes belegt bereits den Port / „EADDRINUSE“**
→ Öffne `.env` im Projektordner mit einem Texteditor (z. B.
`nano .env`), ändere `PORT=3000` auf z. B. `PORT=3001`, speichere
(`Strg+O`, Enter, `Strg+X` in `nano`) und starte den Dienst neu:
`sudo systemctl restart discord-panel`.

**Panel nur lokal testen, ohne Domain, von meinem eigenen Rechner aus**
→ Ein SSH-Tunnel leitet einen Port deines Rechners zum Server durch, ohne
dass das Panel öffentlich erreichbar sein muss:
```bash
ssh -L 3000:localhost:3000 dein-benutzer@deine-server-ip
```
Danach im Browser auf deinem eigenen Rechner `http://localhost:3000`
öffnen, während diese SSH-Verbindung offen bleibt.

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

### Netzwerk: `HOST` und `TRUST_PROXY`

Das Panel lauscht standardmäßig nur auf `127.0.0.1` (`HOST` in `.env`) —
von außen nicht erreichbar, nur der lokale Reverse-Proxy kommt heran. Bei
„Erreichbarkeit“-Option 2 (Domain) übernimmt Caddy die öffentliche Seite auf
Port 80/443 und leitet intern an `127.0.0.1:PORT` weiter; `TRUST_PROXY=1`
sorgt dafür, dass das Sitzungs-Cookie dabei korrekt als `Secure` gesetzt
wird. Bei Option 3 (direkte IP ohne HTTPS) setzt das Setup-Skript
`HOST=0.0.0.0`, damit der Server von außen direkt erreichbar ist — ganz
bewusst ohne `TRUST_PROXY`, weil kein Proxy davor steht.

### Manuelle Einrichtung statt `npm run setup`

Falls du lieber alles von Hand einträgst oder einen anderen Reverse-Proxy
(z. B. nginx) statt Caddy verwenden willst: `cp .env.example .env`, die
Werte aus den Schritten 4–5 oben plus einen zufälligen `SESSION_SECRET`
(z. B. `openssl rand -hex 32`) eintragen, dann `npm install && npm start`.
Für einen eigenen Reverse-Proxy: an `127.0.0.1:PORT` weiterleiten und
`TRUST_PROXY=1` setzen, wenn er TLS terminiert.

### Projektstruktur

```
src/
  config.js          Einlesen & Prüfen der Umgebungsvariablen
  db/                 SQLite-Schema und Datenzugriff (node:sqlite)
  discord/            Bot-Client, Event-Handler, Nachrichten-/Bild-Renderer
  web/                Express-App: Routen, Ansichten (EJS), CSS/JS
assets/fonts/         Mitgelieferte Schrift für die Bildvorlagen (SIL OFL)
scripts/setup.js               Interaktive Einrichtung, siehe `npm run setup`
                                (Node.js-Prüfung, Discord-Validierung, Caddy-
                                und systemd-Automatisierung)
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
- **Der Caddy-/systemd-Teil von `npm run setup` ist auf Debian/Ubuntu
  (apt) zugeschnitten.** Auf anderen Distributionen erkennt das Skript das,
  installiert nichts automatisch und zeigt stattdessen an, was von Hand
  einzutragen ist.

Alles andere aus der Funktionsliste ist eingebaut: OAuth2-Anmeldung mit vier
Zugriffsstufen, CSRF-Schutz, Ratenbegrenzung, strikte CSP ohne Inline-Code,
serverseitige Berechtigungsprüfung vor jeder Discord-Aktion, Sitzung in der
Datenbank, geprüfte Uploads, vollständiges Protokoll.
