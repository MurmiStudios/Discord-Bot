# Discord-Bot mit Webpanel

Ein Discord-Bot, der über eine Weboberfläche bedient wird statt über Slash-Commands.
Anmeldung erfolgt mit dem eigenen Discord-Konto.

## Funktionen

- **Direktnachrichten** an einzelne Mitglieder oder an alle Trägerinnen und Träger einer Rolle
- **Kanal-Nachrichten** als einfacher Text oder als Embed
- **Rollen-Nachrichten** — gehen als DM raus, automatisch beim Erhalt der Rolle oder auf Knopfdruck
- **Willkommensnachrichten** als DM beim Serverbeitritt
- **Dynamische Bilder** mit Profilbild und Name des Empfängers, im Panel gestaltbar mit Live-Vorschau
- **Rollenregeln** — wer Rolle B bekommt, verliert automatisch Rolle A
- **Protokoll** über jeden Versand und jede angewandte Regel, mit verständlichem Fehlergrund

## Voraussetzungen

- Node.js **22 oder neuer**
- Eine Discord-Anwendung mit Bot ([Developer Portal](https://discord.com/developers/applications))

## Einrichtung

### 1. Discord-Anwendung anlegen

Im [Developer Portal](https://discord.com/developers/applications) auf **New Application**.

#### ⚠️ Privilegierter Intent — ohne diesen Schritt funktioniert der Bot nicht

**Bot → Privileged Gateway Intents → SERVER MEMBERS INTENT einschalten.**

Ohne diesen Schalter lehnt Discord bereits die Anmeldung ab
(`Used disallowed intents`), und weder Willkommensnachrichten noch Rollenregeln
greifen. `MESSAGE CONTENT INTENT` wird **nicht** gebraucht — der Bot liest nie
Nachrichteninhalte.

#### Weitere Werte notieren

| Wert | Zu finden unter |
|---|---|
| `DISCORD_TOKEN` | Bot → Reset Token |
| `DISCORD_CLIENT_ID` | General Information → Application ID |
| `DISCORD_CLIENT_SECRET` | OAuth2 → Client Secret |

#### Weiterleitungs-URL eintragen

**OAuth2 → Redirects** → `http://localhost:3000/auth/callback` hinzufügen.
Die URL muss **exakt** mit `OAUTH_REDIRECT_URI` in der `.env` übereinstimmen —
schon ein abweichender Schrägstrich am Ende lässt die Anmeldung scheitern.

### 2. Bot auf den Server einladen

Unter **OAuth2 → URL Generator**:

- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Manage Roles`, `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`

Die erzeugte URL öffnen und den Bot auf den Server einladen.

> **Wichtig zur Rollenhierarchie:** Der Bot kann nur Rollen entfernen, die
> **unterhalb** seiner eigenen höchsten Rolle stehen. Ziehe die Bot-Rolle in den
> Servereinstellungen unter *Rollen* möglichst weit nach oben — sonst greifen
> Rollenregeln nicht. Das Panel weist im Regel-Editor darauf hin und graut
> betroffene Rollen aus.

### 3. Server-ID herausfinden

In Discord unter *Einstellungen → Erweitert → Entwicklermodus* einschalten,
dann Rechtsklick auf den Server → **Server-ID kopieren**. Das ist `GUILD_ID`.

### 4. Projekt einrichten

```bash
npm install
cp .env.example .env
```

Danach die `.env` ausfüllen. Für `SESSION_SECRET`:

```bash
openssl rand -hex 32
```

Unter `PANEL_ADMIN_IDS` die eigene Discord-Benutzer-ID eintragen
(Rechtsklick auf den eigenen Namen → *Benutzer-ID kopieren*). Ohne diesen
Eintrag kommt nur ins Panel, wer auf dem Server Administrator ist.

### 5. Starten

```bash
npm start          # normaler Betrieb
npm run dev        # mit automatischem Neustart bei Änderungen
```

Das Panel läuft dann unter der in `BASE_URL` angegebenen Adresse.

## Erste Schritte im Panel

1. **Bildvorlagen** → *Neue Vorlage* anlegen. Hintergrund hochladen, Avatar und
   Texte per Ziehen im Vorschaubild positionieren. Die Vorschau wird auf dem
   Server mit demselben Renderer erzeugt wie die echten Nachrichten — was du
   siehst, wird auch verschickt.
2. **Willkommensnachricht** → Text schreiben, Vorlage auswählen, aktivieren.
   Mit *Test-DM an mich senden* prüfen, ob alles ankommt.
3. **Rollenregeln** → Auslösende Rolle und die zu entfernenden Rollen wählen.
4. **Rollen-Nachrichten** → Text je Rolle hinterlegen, wahlweise mit
   automatischem Versand beim Erhalt der Rolle.

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
alle Mitglieder (dafür braucht es den privilegierten Intent).

## Tests

```bash
npm test                # 79 Tests, ohne Discord-Verbindung
npm run render:sample   # Beispielbilder nach data/generated/
```

Getestet sind unter anderem die Regel-Logik (inklusive Schleifenfreiheit,
Hierarchie und gleichzeitiger Ereignisse), das Vorlagen-Schema, der Renderer,
die OAuth2-Absicherung, die Upload-Prüfung und die Datenbankschicht.

## Fehlersuche

| Symptom | Ursache |
|---|---|
| `Used disallowed intents` beim Start | SERVER MEMBERS INTENT im Developer Portal nicht aktiviert |
| Anmeldung bricht mit „Sicherheitsprüfung fehlgeschlagen“ ab | `OAUTH_REDIRECT_URI` stimmt nicht exakt mit dem Eintrag im Portal überein |
| „Kein Zugriff“ nach der Anmeldung | Eigene Benutzer-ID fehlt in `PANEL_ADMIN_IDS`, und man ist kein Server-Administrator |
| Rollenregel greift nicht | Zielrolle steht über der Bot-Rolle, oder es fehlt „Rollen verwalten“. Das Protokoll nennt den genauen Grund |
| DM kommt nicht an | Der Empfänger hat DMs von Servermitgliedern deaktiviert. Das lässt sich nicht vorab prüfen — das Protokoll zeigt es nach dem Versuch |
| Texte im Bild sind Kästchen | Die Schriften unter `assets/fonts/` fehlen |

## Aufbau

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
- Hochgeladene Bilder werden anhand ihrer ersten Bytes geprüft, nicht anhand
  der Dateiendung, und unter einem selbst erzeugten Namen abgelegt.
- Alle zustandsändernden Formulare sind CSRF-geschützt, die Anmeldung
  zusätzlich über einen `state`-Parameter.

## Lizenzhinweis

Die mitgelieferte Schrift **Inter** steht unter der SIL Open Font License 1.1
(siehe `assets/fonts/Inter-LICENSE.txt`).
