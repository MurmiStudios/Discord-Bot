# Discord-Bot mit Webpanel

Ein Discord-Bot, den du über eine Webseite bedienst statt über Befehle im Chat.
Anmeldung am Panel erfolgt mit deinem Discord-Konto.

## Was der Bot kann

- **Direktnachrichten** an einzelne Mitglieder oder an alle mit einer bestimmten Rolle
- **Kanal-Nachrichten** als normaler Text oder als hübsches Embed
- **Rollen-Nachrichten** als DM — automatisch beim Erhalt der Rolle oder auf Knopfdruck
- **Willkommensnachrichten** als DM, sobald jemand dem Server beitritt
- **Dynamische Bilder** mit Profilbild und Name des Empfängers, im Panel gestaltbar mit Live-Vorschau
- **Rollenregeln** — wer Rolle B bekommt, verliert automatisch Rolle A
- **Protokoll** über jeden Versand, mit verständlichem Grund wenn etwas schiefging

---

# Einrichtung — Schritt für Schritt

Diese Anleitung geht davon aus, dass du **noch nie einen Server eingerichtet hast**.
Jeder Befehl steht vollständig da und kann so kopiert werden. Unter jedem Befehl
steht in einem Satz, was er tut.

Am Ende läuft der Bot **dauerhaft** — auch wenn du dein Terminal schliesst, deinen
Computer ausschaltest oder der Server neu startet.

**Zeitaufwand:** ungefähr 30 Minuten.

> **Wichtig:** Überall wo `DEINE-SERVER-IP` steht, setzt du die echte IP-Adresse
> deines Servers ein (z. B. `203.0.113.45`). Sie steht im Kundenbereich deines
> Server-Anbieters.

---

## Was du brauchst

| | |
|---|---|
| **Einen Server** | Mit Ubuntu 22.04, Ubuntu 24.04 oder Debian 12. Bei Anbietern wie Hetzner, Netcup oder Contabo kostet der kleinste ab etwa 4 € im Monat — das reicht für diesen Bot locker. |
| **Die IP-Adresse des Servers** | Bekommst du vom Anbieter per E-Mail oder findest sie im Kundenbereich. |
| **Das Server-Passwort** | Oder einen SSH-Schlüssel, je nachdem was dein Anbieter eingerichtet hat. |
| **Ein Discord-Konto** | Und einen Server, auf dem du **Administrator** bist. |

---

## Schritt 1 — Mit dem Server verbinden

Öffne auf deinem eigenen Computer ein Terminal:

- **Windows:** Startmenü → „PowerShell“ eingeben → öffnen
- **macOS:** Programme → Dienstprogramme → Terminal
- **Linux:** Strg + Alt + T

Dann verbindest du dich mit dem Server:

```bash
ssh root@DEINE-SERVER-IP
```

Beim allerersten Mal fragt er `Are you sure you want to continue connecting?` —
tippe `yes` und drücke Enter. Danach gibst du das Passwort ein.

> Beim Tippen des Passworts bewegt sich nichts auf dem Bildschirm — keine Sternchen,
> gar nichts. Das ist normal und kein Fehler. Einfach tippen und Enter drücken.

Wenn eine Zeile erscheint, die mit `root@` beginnt, bist du drin. **Alle weiteren
Befehle gibst du in diesem Fenster ein.**

---

## Schritt 2 — Server auf den neuesten Stand bringen

```bash
apt update && apt upgrade -y
```

Holt die Liste verfügbarer Updates und installiert sie. Beim ersten Mal kann das
ein paar Minuten dauern.

> Erscheint ein blauer Bildschirm mit einer Frage zu Konfigurationsdateien:
> einfach mit Enter die Vorauswahl bestätigen.

```bash
apt install -y curl git ufw
```

Installiert drei Programme, die wir gleich brauchen: `curl` zum Herunterladen,
`git` zum Holen des Projekts und `ufw` für die Firewall.

---

## Schritt 3 — Node.js installieren

Der Bot braucht **Node.js in Version 22 oder neuer**. Die Version aus der normalen
Paketquelle von Ubuntu ist meist zu alt, deshalb holen wir sie direkt von den
Node-Entwicklern:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
```

Trägt die offizielle Node.js-Paketquelle in deinen Server ein.

```bash
apt install -y nodejs
```

Installiert Node.js.

**Jetzt prüfen, ob es geklappt hat:**

```bash
node -v
```

Es muss etwas erscheinen, das mit `v22.` beginnt (z. B. `v22.14.0`).

> Erscheint eine kleinere Zahl wie `v18.` oder `v20.`, wiederhole die beiden
> Befehle oben. Mit einer älteren Version startet der Bot nicht.

---

## Schritt 4 — Einen eigenen Benutzer für den Bot anlegen

Der Bot soll **nicht als `root`** laufen. `root` darf auf dem Server alles — wenn
dort je eine Sicherheitslücke auftaucht, ist gleich der ganze Server offen. Ein
eigener Benutzer mit wenig Rechten begrenzt den Schaden.

```bash
adduser --system --group --home /opt/discord-bot discordbot
```

Legt einen Benutzer namens `discordbot` an, der sich nicht anmelden kann und dem
das Verzeichnis `/opt/discord-bot` gehört. Genau dort wird der Bot wohnen.

---

## Schritt 5 — Das Projekt herunterladen

```bash
git clone https://github.com/MurmiStudios/Discord-Bot.git /opt/discord-bot
```

Lädt den Programmcode in das Verzeichnis des Bots.

> Meldet er `destination path already exists and is not an empty directory`, dann
> hat Schritt 4 das Verzeichnis schon angelegt. Dann stattdessen:
> ```bash
> rm -rf /opt/discord-bot && git clone https://github.com/MurmiStudios/Discord-Bot.git /opt/discord-bot
> ```

```bash
cd /opt/discord-bot
```

Wechselt in das Verzeichnis. **Alle folgenden Befehle gibst du von hier aus ein.**

```bash
git checkout claude/discord-bot-web-panel-1jofuq
```

Wechselt auf den Entwicklungszweig mit dem fertigen Bot.

---

## Schritt 6 — Zusatzprogramme installieren

```bash
npm install --omit=dev
```

Lädt alle Bibliotheken herunter, die der Bot benutzt. `--omit=dev` lässt die
Hilfsmittel weg, die nur beim Programmieren gebraucht werden. Das dauert ein bis
zwei Minuten.

> **Falls Fehlermeldungen über `gyp` oder „build“ erscheinen:** dann fehlen
> Werkzeuge zum Übersetzen. Nachinstallieren mit
> `apt install -y build-essential python3` und `npm install --omit=dev` erneut
> ausführen. Normalerweise passiert das nicht — die Bibliotheken bringen fertige
> Bausteine mit.

---

## Schritt 7 — Die Discord-Anwendung anlegen

Jetzt wechselst du kurz in den **Browser** auf deinem normalen Computer. Das
Terminal-Fenster lässt du offen.

Gehe zu **https://discord.com/developers/applications** und melde dich mit deinem
Discord-Konto an.

1. Klicke rechts oben auf **New Application**
2. Gib einen Namen ein (frei wählbar, z. B. „Mein Panel-Bot“)
3. Häkchen bei den Nutzungsbedingungen, dann **Create**

---

## Schritt 8 — Den privilegierten Intent aktivieren ⚠️

**Dieser Schritt ist der wichtigste der ganzen Anleitung.** Ohne ihn startet der
Bot gar nicht erst.

1. Klicke links im Menü auf **Bot**
2. Scrolle runter zu **Privileged Gateway Intents**
3. Schalte **SERVER MEMBERS INTENT** ein
4. Klicke unten auf **Save Changes**

Warum das nötig ist: Discord gibt einem Bot standardmässig keine Informationen
über die Mitglieder eines Servers. Ohne diese Erlaubnis erfährt der Bot nie, dass
jemand beigetreten ist oder eine Rolle bekommen hat — Willkommensnachrichten und
Rollenregeln könnten also gar nicht funktionieren.

> **MESSAGE CONTENT INTENT lässt du aus.** Dieser Bot liest niemals
> Nachrichteninhalte und braucht die Erlaubnis nicht.

---

## Schritt 9 — Die drei Geheimwerte abholen

Du brauchst drei Werte. Schreibe sie dir in einen Texteditor — du fügst sie
gleich alle zusammen ein.

**Wert 1 — der Bot-Token**

Immer noch unter **Bot**: klicke auf **Reset Token** und bestätige. Der lange
Text, der erscheint, ist dein Token. Klicke **Copy**.

> **Der Token ist wie das Passwort deines Bots.** Wer ihn hat, kann den Bot
> vollständig steuern. Nie in einen Chat schreiben, nie auf GitHub hochladen,
> niemandem schicken. Er wird dir nur dieses eine Mal angezeigt — verlierst du
> ihn, klickst du einfach wieder auf *Reset Token*.

**Wert 2 — die Application ID**

Klicke links auf **General Information** → unter **Application ID** auf **Copy**.

**Wert 3 — das Client Secret**

Klicke links auf **OAuth2** → unter **Client Secret** auf **Reset Secret** →
bestätigen → **Copy**.

---

## Schritt 10 — Die Weiterleitungs-Adresse eintragen

Immer noch unter **OAuth2**, etwas weiter unten beim Abschnitt **Redirects**:

1. Klicke **Add Redirect**
2. Trage genau das ein (mit deiner echten IP statt `DEINE-SERVER-IP`):

```
http://DEINE-SERVER-IP:3000/auth/callback
```

3. **Save Changes**

Diese Adresse sagt Discord, wohin es dich nach der Anmeldung zurückschicken soll.

> **Sie muss buchstabengenau stimmen.** Ein zusätzlicher Schrägstrich am Ende,
> `https` statt `http` oder ein Tippfehler in der IP — und die Anmeldung
> scheitert mit einer Fehlermeldung von Discord. Später trägst du **exakt
> dieselbe** Adresse in die Konfigurationsdatei ein.

---

## Schritt 11 — Den Bot auf deinen Server einladen

Immer noch unter **OAuth2**, scrolle zu **OAuth2 URL Generator**:

**Bei SCOPES ankreuzen:**
- `bot`
- `applications.commands`

**Darunter erscheint BOT PERMISSIONS. Dort ankreuzen:**
- `Manage Roles`
- `View Channels`
- `Send Messages`
- `Embed Links`
- `Attach Files`

Ganz unten erscheint eine lange URL. Kopiere sie, füge sie in ein neues
Browser-Tab ein, wähle deinen Discord-Server aus und klicke **Autorisieren**.

### Danach unbedingt: die Bot-Rolle nach oben ziehen

Öffne Discord → dein Server → **Servereinstellungen** → **Rollen**.

Dort siehst du eine Rolle mit dem Namen deines Bots. **Ziehe sie mit der Maus
möglichst weit nach oben** — mindestens über alle Rollen, die der Bot später
entfernen können soll.

Grund: Discord erlaubt einem Bot nur, Rollen zu verwalten, die **unter** seiner
eigenen Rolle stehen. Steht die Bot-Rolle ganz unten, kann er gar nichts tun und
die Rollenregeln greifen einfach nicht. Das Panel warnt dich später zwar, aber
hier ist es in fünf Sekunden erledigt.

---

## Schritt 12 — Zwei IDs herausfinden

Zuerst den Entwicklermodus einschalten, sonst gibt es die nötigen Menüpunkte nicht:

**Discord → Benutzereinstellungen (Zahnrad unten links) → Erweitert →
Entwicklermodus einschalten**

**ID 1 — dein Server**

Rechtsklick auf den Servernamen ganz oben links → **Server-ID kopieren**

**ID 2 — du selbst**

Rechtsklick auf deinen eigenen Namen in der Mitgliederliste rechts →
**Benutzer-ID kopieren**

Diese zweite ID sorgt dafür, dass **du** ins Panel darfst. Ohne sie kommen nur
Server-Administratoren hinein.

---

## Schritt 13 — Die Konfigurationsdatei anlegen

Zurück ins **Terminal-Fenster**.

Zuerst erzeugen wir ein zufälliges Geheimnis, mit dem der Bot deine Anmeldung
absichert:

```bash
openssl rand -hex 32
```

Es erscheint eine lange Reihe aus Zahlen und Buchstaben. **Kopiere sie** — du
brauchst sie gleich.

Jetzt die Datei anlegen:

```bash
nano /opt/discord-bot/.env
```

`nano` ist ein einfacher Texteditor direkt im Terminal. Füge folgenden Text ein
und ersetze alle `HIER_...`-Stellen durch deine Werte:

```dotenv
# ── Discord ───────────────────────────────────────────────
DISCORD_TOKEN=HIER_DEIN_BOT_TOKEN
DISCORD_CLIENT_ID=HIER_DEINE_APPLICATION_ID
DISCORD_CLIENT_SECRET=HIER_DEIN_CLIENT_SECRET
GUILD_ID=HIER_DEINE_SERVER_ID

# ── Zugang zum Panel ──────────────────────────────────────
OAUTH_REDIRECT_URI=http://DEINE-SERVER-IP:3000/auth/callback
PANEL_ADMIN_IDS=HIER_DEINE_BENUTZER_ID
PANEL_REQUIRE_GUILD_ADMIN=true

# ── Webserver ─────────────────────────────────────────────
PORT=3000
BASE_URL=http://DEINE-SERVER-IP:3000
SESSION_SECRET=HIER_DIE_LANGE_ZEICHENFOLGE_VON_OPENSSL
NODE_ENV=production
ALLOW_INSECURE_HTTP=true

# ── Rest kann so bleiben ──────────────────────────────────
DATA_DIR=./data
MAX_UPLOAD_MB=8
MAX_IMAGE_DIMENSION=4000
DM_DELAY_MS=1500
DM_MAX_RECIPIENTS=200
LOG_LEVEL=info
```

**Einfügen im Terminal:** Rechtsklick, oder Strg + Shift + V (Windows/Linux),
oder Cmd + V (Mac).

**Speichern und schliessen:** `Strg + O`, dann `Enter`, dann `Strg + X`.

### Was die wichtigsten Zeilen bedeuten

| Zeile | Bedeutung |
|---|---|
| `PANEL_ADMIN_IDS` | Wer ins Panel darf. Mehrere IDs mit Komma trennen: `111,222,333` |
| `PANEL_REQUIRE_GUILD_ADMIN` | Bei `true` dürfen zusätzlich alle Server-Administratoren rein |
| `SESSION_SECRET` | Damit werden Anmeldungen signiert. Muss lang und zufällig sein |
| `NODE_ENV=production` | Blendet technische Fehlerdetails aus, die Angreifern helfen würden |
| `ALLOW_INSECURE_HTTP` | Erlaubt den Betrieb ohne HTTPS — siehe Kasten unten |
| `DM_DELAY_MS` | Pause zwischen zwei DMs beim Massenversand, damit Discord nicht bremst |

> ### ⚠️ Zur Verschlüsselung
>
> `ALLOW_INSECURE_HTTP=true` erlaubt den Betrieb **ohne HTTPS**. Das ist für den
> Anfang völlig in Ordnung, hat aber eine echte Konsequenz: Dein Anmelde-Cookie
> reist unverschlüsselt durchs Netz. In einem fremden WLAN könnte es jemand
> mitlesen und damit dein Panel öffnen — **nicht** deinen Discord-Account,
> aber das Panel.
>
> Ohne diesen Schalter würde der Bot den Start verweigern; er ist bewusst eine
> ausdrückliche Entscheidung und kein Versehen.
>
> Sobald du eine Domain hast, stellst du auf HTTPS um — siehe ganz unten
> „Später auf HTTPS umstellen“. Dann fällt dieser Schalter wieder weg.

### Die Datei absichern

```bash
chmod 600 /opt/discord-bot/.env
```

Nur der Eigentümer darf die Datei lesen — sie enthält schliesslich deinen
Bot-Token.

```bash
chown -R discordbot:discordbot /opt/discord-bot
```

Übergibt das gesamte Verzeichnis an den Bot-Benutzer aus Schritt 4.

```bash
git config --global --add safe.directory /opt/discord-bot
```

Einmalig nötig: Das Verzeichnis gehört jetzt `discordbot`, du arbeitest aber als
`root`. Ohne diese Zeile verweigert Git später jedes `git pull` mit
*„detected dubious ownership"*. Die Sperre schützt davor, dass fremder Code aus
einem Repository eines anderen Nutzers als `root` ausgeführt wird — hier hast du
beide Konten selbst angelegt, deshalb ist die Ausnahme in Ordnung.

---

## Schritt 14 — Der erste Testlauf

Bevor wir den Dauerbetrieb einrichten, starten wir den Bot einmal von Hand. So
siehst du Fehler sofort im Klartext.

```bash
cd /opt/discord-bot && sudo -u discordbot node src/index.js
```

**So sieht es aus, wenn alles stimmt:**

```
{"level":30,...,"msg":"Migration angewandt"}
{"level":30,...,"msg":"Datenbank bereit"}
{"level":30,...,"msg":"Panel erreichbar unter http://DEINE-SERVER-IP:3000"}
{"level":40,...,"msg":"Das Panel läuft OHNE HTTPS..."}
{"level":30,...,"msg":"Mit Discord verbunden"}
{"level":30,...,"msg":"Rollen-Momentaufnahmen befüllt"}
{"level":30,...,"msg":"Server bereit"}
```

Die Zeile über fehlendes HTTPS ist **erwartet** — sie erinnert nur an den Kasten
oben. „Migration angewandt“ erscheint nur beim allerersten Start: da legt der Bot
seine Datenbank an.

**Wenn stattdessen ein Fehler kommt**, schau unten bei [Wenn etwas nicht
klappt](#wenn-etwas-nicht-klappt) — die häufigsten stehen dort mit Lösung.

Beende den Testlauf mit **`Strg + C`**.

---

## Schritt 15 — Die Firewall einrichten

> **Achtung, Reihenfolge:** Der erste Befehl muss zuerst kommen. Aktivierst du
> die Firewall ohne ihn, sperrst du dich selbst vom Server aus und kommst nur
> noch über die Notfall-Konsole deines Anbieters wieder rein.

```bash
ufw allow OpenSSH
```

Hält deinen SSH-Zugang offen.

```bash
ufw allow 3000/tcp
```

Öffnet den Port, auf dem das Panel läuft.

```bash
ufw enable
```

Schaltet die Firewall ein. Bestätige mit `y`.

```bash
ufw status
```

Zeigt zur Kontrolle die offenen Ports. Es müssen `OpenSSH` und `3000/tcp`
auftauchen.

---

## Schritt 16 — Dauerbetrieb einrichten

Bisher läuft der Bot nur, solange dein Terminal offen ist. Jetzt machen wir einen
**Dienst** daraus: Er startet automatisch mit dem Server und wird nach einem
Absturz neu gestartet.

Zuerst stellen wir sicher, dass der Datenordner existiert:

```bash
mkdir -p /opt/discord-bot/data && chown -R discordbot:discordbot /opt/discord-bot
```

Der Dienst wird gleich so abgesichert, dass er **nur** in diesen einen Ordner
schreiben darf. Fehlt der Ordner beim Start, bricht systemd mit einer
schwer verständlichen Meldung ab — mit diesem Befehl kann das nicht passieren.

Dann prüfen, wo Node.js liegt:

```bash
which node
```

Normalerweise antwortet er `/usr/bin/node`. **Kommt etwas anderes heraus,
merke dir den Pfad** — du trägst ihn gleich statt `/usr/bin/node` ein.

Jetzt die Dienstbeschreibung anlegen:

```bash
nano /etc/systemd/system/discord-bot.service
```

Füge Folgendes ein:

```ini
[Unit]
Description=Discord-Bot mit Webpanel
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=discordbot
Group=discordbot
WorkingDirectory=/opt/discord-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5

# Der Dienst darf nur das, was er wirklich braucht.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
# Einziges Verzeichnis mit Schreibrecht: dort liegen Datenbank und Uploads.
ReadWritePaths=/opt/discord-bot/data

StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-bot

[Install]
WantedBy=multi-user.target
```

Speichern mit `Strg + O`, `Enter`, `Strg + X`.

**Was die Zeilen bewirken:** `Restart=always` startet den Bot nach jedem Absturz
neu. `StartLimitBurst=5` gibt nach fünf Fehlversuchen in einer Minute auf, statt
ewig weiterzuprobieren. Der Block darunter nimmt dem Dienst alle Rechte, die er
nicht braucht — er darf nur in sein eigenes `data`-Verzeichnis schreiben.

Jetzt starten:

```bash
systemctl daemon-reload
```

Liest die neue Dienstbeschreibung ein.

```bash
systemctl enable --now discord-bot
```

Startet den Bot **und** sorgt dafür, dass er künftig beim Hochfahren automatisch
mitstartet.

```bash
systemctl status discord-bot
```

Zeigt den Zustand. Es muss grün **`active (running)`** dastehen. Mit `q` verlässt
du die Anzeige.

### Den Neustart testen

```bash
reboot
```

Startet den Server neu. Deine SSH-Verbindung bricht ab — das ist normal. Warte
etwa eine Minute, dann verbinde dich neu und prüfe:

```bash
ssh root@DEINE-SERVER-IP
systemctl status discord-bot
```

Steht wieder `active (running)` da, ist der Dauerbetrieb fertig eingerichtet. 🎉

---

## Schritt 17 — Ins Panel einloggen

Öffne im Browser:

```
http://DEINE-SERVER-IP:3000
```

Klicke auf **Mit Discord anmelden**. Discord fragt einmal nach deiner Erlaubnis,
danach landest du in der Übersicht.

> Der Browser warnt möglicherweise „Nicht sicher“ in der Adressleiste. Das liegt
> am fehlenden HTTPS und ist bei dieser Einrichtung erwartet.

### Die ersten Schritte im Panel

**1. Eine Bildvorlage anlegen** → *Bildvorlagen* → *Neue Vorlage*

Gib ihr einen Namen, lade bei Bedarf ein Hintergrundbild hoch und **ziehe
Profilbild und Texte direkt im Vorschaubild** an die richtige Stelle. Die
Vorschau wird auf dem Server erzeugt — mit genau demselben Code, der später die
echten Nachrichten baut. Was du siehst, wird also auch verschickt.

**2. Willkommensnachricht einrichten** → *Willkommensnachricht*

Text schreiben, Vorlage auswählen, Häkchen bei *aktiv*, speichern. Mit
**Test-DM an mich senden** prüfst du sofort, ob alles ankommt.

**3. Eine Rollenregel anlegen** → *Rollenregeln*

Wähle oben die auslösende Rolle und darunter die Rollen, die entfernt werden
sollen. Nicht verwaltbare Rollen sind ausgegraut — dann steht die Bot-Rolle zu
weit unten (siehe Schritt 11).

**4. Rollen-Nachrichten** → *Rollen-Nachrichten*

Text je Rolle hinterlegen. Mit *Automatisch senden* geht er raus, sobald jemand
die Rolle erhält.

---

## Laufender Betrieb

### Was tut der Bot gerade?

```bash
journalctl -u discord-bot -f
```

Zeigt die Ausgaben live mit. Beenden mit `Strg + C` (der Bot läuft weiter — du
schaust nur nicht mehr zu).

```bash
journalctl -u discord-bot -n 100
```

Zeigt die letzten 100 Zeilen, auch von früher.

```bash
journalctl -u discord-bot --since "1 hour ago" -p warning
```

Zeigt nur Warnungen und Fehler der letzten Stunde — praktisch bei der Fehlersuche.

### Starten, stoppen, neu starten

```bash
systemctl restart discord-bot    # neu starten
systemctl stop discord-bot       # anhalten
systemctl start discord-bot      # wieder starten
systemctl status discord-bot     # Zustand ansehen
```

### Einstellungen ändern

```bash
nano /opt/discord-bot/.env
systemctl restart discord-bot
```

Änderungen an der `.env` werden erst beim Neustart des Dienstes wirksam.

### Auf eine neue Version aktualisieren

```bash
cd /opt/discord-bot
git pull
npm install --omit=dev
chown -R discordbot:discordbot /opt/discord-bot
systemctl restart discord-bot
```

Holt den neuen Code, aktualisiert die Bibliotheken, richtet die Besitzrechte
wieder her und startet neu.

> Meldet `git pull` *„detected dubious ownership"*, fehlt der einmalige Schritt
> aus Schritt 13:
> ```bash
> git config --global --add safe.directory /opt/discord-bot
> ```
> Danach die Befehle oben erneut ausführen. **Achte darauf, dass `git pull` und
> `npm install` wirklich durchgelaufen sind** — bricht einer ab, startet der
> Dienst sonst wieder mit dem alten Code.

### Sicherung anlegen

Alles, was du im Panel eingestellt hast — Vorlagen, Regeln, Nachrichten,
Protokoll — steckt im Ordner `data`. Nur der ist es wert, gesichert zu werden;
alles andere lässt sich jederzeit neu herunterladen.

```bash
systemctl stop discord-bot
tar czf ~/discord-bot-sicherung-$(date +%F).tar.gz -C /opt/discord-bot data
systemctl start discord-bot
```

Hält den Bot kurz an (damit die Datenbank nicht mitten im Schreiben kopiert
wird), packt den `data`-Ordner mit dem heutigen Datum im Namen zusammen und
startet wieder.

Die entstandene `.tar.gz`-Datei lädst du dann auf deinen eigenen Computer:

```bash
# Diesen Befehl auf DEINEM Computer eingeben, nicht auf dem Server:
scp root@DEINE-SERVER-IP:~/discord-bot-sicherung-*.tar.gz .
```

---

## Wenn etwas nicht klappt

| Was du siehst | Woran es liegt und was hilft |
|---|---|
| `Used disallowed intents` | **SERVER MEMBERS INTENT** ist nicht aktiviert. Zurück zu Schritt 8. |
| `Discord hat den Bot-Token abgelehnt` | Tippfehler beim `DISCORD_TOKEN`, oder du hast nach dem Kopieren *Reset Token* nochmal geklickt — dann ist der alte ungültig. Neu kopieren, in die `.env` eintragen, `systemctl restart discord-bot`. |
| Discord zeigt `Invalid OAuth2 redirect_uri` | Die Adresse im Developer Portal (Schritt 10) und `OAUTH_REDIRECT_URI` in der `.env` sind nicht identisch. Beide vergleichen — Zeichen für Zeichen. |
| Anmeldung sagt „Sicherheitsprüfung fehlgeschlagen“ | Meist derselbe Grund wie oben. Sonst: Seite neu laden und die Anmeldung frisch über `/login` starten, statt einen alten Link zu benutzen. |
| Nach der Anmeldung „Kein Zugriff“ | Deine Benutzer-ID fehlt in `PANEL_ADMIN_IDS`, oder es hat sich ein Leerzeichen eingeschlichen. Prüfen mit `grep PANEL_ADMIN /opt/discord-bot/.env`. |
| Browser zeigt gar nichts / Zeitüberschreitung | Firewall (Schritt 15) oder der Dienst läuft nicht. Prüfen mit `systemctl status discord-bot` und `ufw status`. Manche Anbieter haben zusätzlich eine eigene Firewall im Kundenbereich — dort Port 3000 freigeben. |
| `EADDRINUSE` beim Start | Port 3000 ist belegt. Entweder läuft der Bot doppelt (`systemctl stop discord-bot`), oder du nimmst in der `.env` einen anderen `PORT` — dann aber auch `BASE_URL`, `OAUTH_REDIRECT_URI`, die Firewall-Regel **und** den Eintrag im Developer Portal anpassen. |
| Fehler mit `gyp` bei `npm install` | `apt install -y build-essential python3`, dann `npm install --omit=dev` wiederholen. |
| Rollenregel greift nicht | Die zu entfernende Rolle steht über der Bot-Rolle. Bot-Rolle nach oben ziehen (Schritt 11). Das Protokoll im Panel nennt den genauen Grund. |
| DM kommt nicht an | Der Empfänger hat DMs von Servermitgliedern deaktiviert. Das lässt sich vorher **nicht** prüfen — Discord bietet keine Möglichkeit dazu. Das Panel zeigt es nach dem Versuch im Protokoll, und der restliche Versand läuft normal weiter. |
| Texte im Bild sind lauter Kästchen | Die Schriften unter `assets/fonts/` fehlen. `git checkout assets/fonts` im Projektverzeichnis holt sie zurück. |
| `detected dubious ownership in repository` | Das Verzeichnis gehört `discordbot`, du arbeitest als `root`. Einmalig `git config --global --add safe.directory /opt/discord-bot` ausführen, dann das Update wiederholen. |
| Dienst startet immer wieder neu | `journalctl -u discord-bot -n 50` zeigt den Grund. Meist ein Fehler in der `.env`. |

---

## Später auf HTTPS umstellen

Sobald du eine Domain hast (z. B. `panel.deine-domain.de`), lohnt sich der
Wechsel: verschlüsselte Verbindung, keine Browser-Warnung mehr, und das
Anmelde-Cookie ist unterwegs geschützt.

Grober Ablauf:

1. Beim Domain-Anbieter einen **A-Record** anlegen, der auf deine Server-IP zeigt
2. `apt install -y nginx certbot python3-certbot-nginx`
3. nginx als Vermittler einrichten, der Anfragen an `localhost:3000` weiterreicht
4. `certbot --nginx -d panel.deine-domain.de` holt ein kostenloses Zertifikat
5. In der `.env` ändern:
   - `BASE_URL=https://panel.deine-domain.de`
   - `OAUTH_REDIRECT_URI=https://panel.deine-domain.de/auth/callback`
   - `TRUST_PROXY=1`
   - `ALLOW_INSECURE_HTTP` löschen oder auf `false` setzen
6. Die neue Weiterleitungs-Adresse im Discord Developer Portal eintragen
7. Port 3000 wieder schliessen: `ufw delete allow 3000/tcp`, dafür
   `ufw allow 'Nginx Full'`
8. `systemctl restart discord-bot`

---
---

# Nachschlagen

## Platzhalter

Nutzbar in allen Textfeldern — auch in den Textfeldern der Bildvorlagen.

| Platzhalter | Bedeutung |
|---|---|
| `{user}` | Anzeigename des Empfängers |
| `{tag}` | Discord-Benutzername |
| `{guild}` | Name des Servers |
| `{role}` | Name der Rolle (bei Rollen-Nachrichten) |
| `{count}` | Mitgliederzahl |

## Wie die Rollenregeln arbeiten

Eine Regel bedeutet: *Wenn ein Mitglied Rolle B erhält, entferne ihm Rolle A.*

Zwei Eigenschaften sind bewusst so gebaut:

**Keine Endlosschleife.** Regeln reagieren ausschliesslich auf *hinzugefügte*
Rollen und *entfernen* nur. Entfernt der Bot eine Rolle, löst das zwar erneut ein
Ereignis aus — dabei wurde aber nichts hinzugefügt, also endet die Auswertung
sofort. Das gilt auch bei sich widersprechenden Regeln („B entfernt A“ und
gleichzeitig „A entfernt B“). Eine gerade vergebene Rolle wird nie wieder
entzogen.

**Korrekt auch nach einem Neustart.** Der Vergleich läuft gegen eine in der
Datenbank gespeicherte Momentaufnahme, nicht gegen den Zwischenspeicher von
discord.js. Letzterer ist nach einem Neustart unvollständig und würde
fälschlich melden, alle Rollen seien gerade vergeben worden — was
Massen-Entfernungen auslösen würde. Beim Start lädt der Bot deshalb einmalig
alle Mitglieder (dafür braucht es den privilegierten Intent aus Schritt 8).

## Alle Einstellungen der `.env`

| Variable | Bedeutung |
|---|---|
| `DISCORD_TOKEN` | Bot-Token aus dem Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_CLIENT_SECRET` | OAuth2 Client Secret |
| `GUILD_ID` | ID des verwalteten Servers |
| `OAUTH_REDIRECT_URI` | Rücksprungadresse, exakt wie im Portal hinterlegt |
| `PANEL_ADMIN_IDS` | Benutzer-IDs mit Panel-Zugriff, komma-getrennt |
| `PANEL_REQUIRE_GUILD_ADMIN` | `true` = Server-Administratoren dürfen ebenfalls |
| `PANEL_ALLOWED_ROLE_IDS` | Optional: Rollen-IDs mit Panel-Zugriff |
| `PORT` | Port des Webservers |
| `BASE_URL` | Öffentliche Adresse des Panels |
| `SESSION_SECRET` | Signiert die Anmeldungen, mindestens 32 Zeichen |
| `TRUST_PROXY` | `1`, wenn nginx oder ein anderer Proxy davorsteht |
| `NODE_ENV` | `production` im Echtbetrieb |
| `ALLOW_INSECURE_HTTP` | `true` erlaubt Betrieb ohne HTTPS |
| `DATA_DIR` | Wo Datenbank und Uploads liegen |
| `MAX_UPLOAD_MB` | Grössenlimit für Hintergrundbilder |
| `MAX_IMAGE_DIMENSION` | Maximale Kantenlänge hochgeladener Bilder |
| `DM_DELAY_MS` | Pause zwischen zwei DMs beim Massenversand |
| `DM_MAX_RECIPIENTS` | Obergrenze für Empfänger pro Aktion |
| `LOG_LEVEL` | `info`, `warn`, `error` oder `debug` |

## Für Entwickler

```bash
npm test                # 93 Tests, ohne Discord-Verbindung
npm run render:sample   # Beispielbilder nach data/generated/
npm run dev             # Start mit automatischem Neustart bei Änderungen
```

Getestet sind die Regel-Logik (inklusive Schleifenfreiheit, Rollenhierarchie und
gleichzeitiger Ereignisse), das Vorlagen-Schema, der Bild-Renderer, die
OAuth2-Absicherung, die Upload-Prüfung, die Konfigurationsregeln, die
Content-Security-Policy und die Datenbankschicht.

Die Oberfläche wird zusätzlich im Browser geprüft. Das ist kein Luxus: eine
falsch gesetzte CSP-Direktive liess das Panel einmal komplett ohne Gestaltung
ausliefern, und `curl` konnte das nicht zeigen — es ignoriert CSP vollständig.

### Aufbau

```
src/
├─ config.js            Umgebungsvariablen prüfen (bricht mit klarer Meldung ab)
├─ db/                  SQLite, Migrationen, Repositories
├─ images/              Vorlagen-Schema, Avatar-Abruf, Renderer
├─ bot/
│  ├─ events/           guildMemberAdd / Update / Remove
│  └─ services/         Versand, Rollen, Regel-Auswertung
└─ web/
   ├─ auth/             Discord-OAuth2 und Zugriffsschutz
   ├─ routes/           eine Datei je Panel-Bereich
   └─ views/            EJS-Ansichten (deutsch)
```

## Sicherheit

- Der Bot-Token wird nur beim Start gelesen und landet nie in einer Ansicht,
  einer Logzeile oder einer Fehlerseite.
- Die Anmeldung fordert ausschliesslich den Scope `identify` an. Mitgliedschaft
  und Rechte werden über den Bot-Token gelesen, nicht über vom Nutzer gewährte
  Berechtigungen. Das Zugriffstoken wird nach der Anmeldung verworfen.
- Die Zugriffsberechtigung wird bei jeder Anfrage geprüft (60 Sekunden
  zwischengespeichert) — ein entzogener Admin-Status sperrt sofort aus.
- Hochgeladene Bilder werden anhand ihrer ersten Bytes geprüft, nicht anhand der
  Dateiendung, und unter einem selbst erzeugten Namen abgelegt.
- Alle zustandsändernden Formulare sind CSRF-geschützt, die Anmeldung zusätzlich
  über einen `state`-Parameter.

## Lizenzhinweis

Die mitgelieferte Schrift **Inter** steht unter der SIL Open Font License 1.1
(siehe `assets/fonts/Inter-LICENSE.txt`).
