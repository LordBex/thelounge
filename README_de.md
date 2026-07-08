<h1 align="center">
	<img
		width="300"
		alt="The Lounge"
		src="https://raw.githubusercontent.com/thelounge/thelounge/master/client/img/logo-vertical-transparent-bg.svg?sanitize=true">
</h1>

<h3 align="center">
	Moderner, selbst gehosteter Web-IRC-Client — mit FiSH-Verschlüsselung, DH1080-Key-Exchange, FTP-Invites und mehr
</h3>

<p align="center">
	<strong>
		<a href="https://thelounge.chat/">Upstream-Website</a>
		•
		<a href="https://thelounge.chat/docs">Upstream-Docs</a>
		•
		<a href="https://github.com/LordBex/thelounge-docker">Docker</a>
	</strong>
</p>

<p align="center">
	<a href="https://github.com/LordBex/thelounge/actions"><img
		alt="Build Status"
		src="https://github.com/LordBex/thelounge/workflows/Build/badge.svg"></a>
</p>

<p align="center">
	<img src="https://raw.githubusercontent.com/thelounge/thelounge.github.io/master/img/thelounge-screenshot.png" width="550">
</p>

<p align="center">
	<strong>🇬🇧 <a href="README.md">English</a></strong>
</p>

---

## Über diesen Fork

Dies ist ein Fork von [The Lounge](https://github.com/thelounge/thelounge) (`@lordbex/thelounge`), der dem modernen, selbst gehosteten Web-Client eine Reihe klassischer IRC-Power-User-Funktionen hinzufügt:

- 🔐 **FiSH-Verschlüsselung (Blowfish)** für Channels und private Querys — ECB **und** CBC-Modus, kompatibel mit mIRC, HexChat, WeeChat und anderen FiSH-Clients.
- 🤝 **DH1080-Key-Exchange** — handelt automatisch einen gemeinsamen Blowfish-Schlüssel mit einem anderen User direkt in der PN aus, ohne dass Schlüssel manuell ausgetauscht werden müssen.
- 📁 **FTP-Invites** — sendet FTP-`SITE INVITE`-Befehle direkt aus IRC an deinen FTP-Server, optional automatisch beim Verbinden.
- 🌍 **Zeichensatz pro Nick** — dekodiert Nachrichten einzelner User mit einem bestimmten Zeichensatz (utf8, latin1, cp1252, …).
- 🌈 **Rainbow-Text** und ein paar zusätzliche Komfort-Befehle (`/mute`, `/unmute`).

Alles, was The Lounge bereits bietet, bleibt erhalten; die genannten Funktionen kommen additiv hinzu und lassen sich einzeln über die Server-Konfiguration ein- und ausschalten.

> ⚠️ **Sicherheitshinweis:** FiSH/Blowfish und DH1080 sind alte IRC-Verfahren. Insbesondere DH1080 **authentifiziert das Gegenüber nicht** und ist daher anfällig für Man-in-the-Middle-Angriffe. Betrachte diese Funktionen als Verschleierung / einfachen Schutz gegen passive Mitleser, **nicht** als starke Ende-zu-Ende-Verschlüsselung.

## Funktionsüberblick (Upstream)

- **Moderne Features für IRC.** Push-Benachrichtigungen, Link-Vorschauen, Markierungen für neue Nachrichten und mehr bringen IRC ins 21. Jahrhundert.
- **Immer verbunden.** Bleibt mit den IRC-Servern verbunden, auch wenn du offline bist.
- **Plattformübergreifend.** Egal welches Betriebssystem — es läuft überall, wo Node.js läuft.
- **Responsive Oberfläche.** Funktioniert flüssig auf Desktop, Smartphone und Tablet.
- **Synchronisiertes Erlebnis.** Mach genau dort weiter, wo du aufgehört hast — auf jedem Gerät.

Mehr zur Basis-Konfiguration, Nutzung und den Features von The Lounge findest du auf der [Upstream-Website](https://thelounge.chat).

The Lounge ist der offizielle, von der Community gepflegte Fork von [Shout](https://github.com/erming/shout) von [Mattias Erming](https://github.com/erming).

## 🔐 FiSH-Verschlüsselung (Blowfish)

FiSH verschlüsselt den *Nachrichtentext* von Channel- und Query-Nachrichten mit Blowfish, kodiert im klassischen FiSH-Base64-Alphabet, sodass es mit traditionellen IRC-Clients zusammenarbeitet.

### Modi

| Modus   | Hinweise                                                                       |
| ------- | ------------------------------------------------------------------------------ |
| **ECB** | Standard. Maximale Kompatibilität mit alten Clients. Schwächer (kein IV).       |
| **CBC** | Empfohlen. Nutzt pro Nachricht einen zufälligen IV. Beide Seiten müssen ihn unterstützen. |

### Befehl `/blow`

```text
/blow                      Aktuellen Schlüsselstatus für diesen Channel/diese Query anzeigen
/blow <key>                Schlüssel setzen (Standard: ECB-Modus)
/blow <key> ecb            Schlüssel setzen und ECB-Modus erzwingen
/blow <key> cbc            Schlüssel setzen und CBC-Modus erzwingen
/blow off                  Schlüssel für diesen Channel/diese Query löschen
/blow clear                Alias für /blow off
```

Der Schlüssel wird pro Ziel (Channel-Name oder Nick) gespeichert und übersteht Neustarts. Ausgehende Nachrichten werden automatisch verschlüsselt, eingehende verschlüsselte Nachrichten bei vorhandenem Schlüssel transparent entschlüsselt.

### Schlüssel in der Oberfläche konfigurieren

Öffne **Netzwerk-Einstellungen → FiSH (Blowfish)**. Dort kannst du festlegen:

- **Globaler Schlüssel + Modus** — ein Standardschlüssel für das gesamte Netzwerk.
- **Schlüssel pro Channel / pro User** — eine Tabelle mit `#channel`- oder `nick`-Einträgen → Schlüssel → Modus.

### Funktion aktivieren

In der Server-`config.js`:

```js
fish: {
    enabled: true,
    allowKeyExchange: true,
},
```

Ist `fish.enabled` auf `false` gesetzt, wird der FiSH-Bereich in der Oberfläche ausgeblendet, der Befehl `/blow` abgelehnt und sämtliche Ver-/Entschlüsselungsschritte übersprungen.

## 🤝 DH1080-Key-Exchange (in der privaten Nachricht)

Statt einen Blowfish-Schlüssel außerhalb von IRC auszutauschen, kannst du ihn mit dem **DH1080**-Diffie-Hellman-Verfahren automatisch mit einem anderen User aushandeln. Es ist dasselbe Standardverfahren wie in WeeChats `fish.py`, mIRC-FiSH usw. und funktioniert daher clientübergreifend.

### Befehl `/keyexchange`

```text
/keyexchange <nick>            Key-Exchange mit <nick> starten (ECB-Modus)
/keyexchange ecb <nick>        Exchange starten, ECB-Modus anfragen
/keyexchange cbc <nick>        Exchange starten, CBC-Modus anfragen
/ke <nick>                     Kurz-Alias für /keyexchange
```

### Ablauf

1. Du führst `/ke <nick>` aus (optional mit Modus). Der Client erzeugt ein DH-Schlüsselpaar und sendet eine `DH1080_INIT`-Notice an den anderen User.
2. Dessen Client antwortet mit `DH1080_FINISH` inklusive seines öffentlichen Schlüssels.
3. Beide Seiten leiten dasselbe gemeinsame Geheimnis ab, das zum Blowfish-Schlüssel deiner privaten Query mit diesem Nick wird — automatisch, ohne Kopieren und Einfügen.
4. Die rohen `DH1080_INIT`-/`DH1080_FINISH`-Notices werden im Chat ausgeblendet; du siehst nur eine Bestätigung.
5. Kommt innerhalb von **2 Minuten** keine Antwort, läuft der ausstehende Exchange ab und wird verworfen.

Der ausgehandelte Modus (ECB/CBC) wird auf beiden Seiten berücksichtigt — eine CBC-Anfrage hängt eine ` CBC`-Markierung an, die kompatible Clients verstehen.

### Voraussetzungen

- `fish.enabled: true` **und** `fish.allowKeyExchange: true` in der `config.js`.
- Eine aktive Verbindung zum IRC-Netzwerk.

> ⚠️ DH1080 prüft keine Identität. Wer deine Notices abfangen und umschreiben kann, kann sich in den Exchange einklinken. Setze es entsprechend bewusst ein.

## 📁 FTP-Invites

Sende FTP-`SITE INVITE`-Befehle direkt aus IRC an einen FTP-Server — praktisch für private File-Sharing-Channels, deren Zugang über eine FTP-Whitelist geregelt wird.

### Befehle

```text
/ftp status                Zeigt, ob FTP-Invites aktiv sind, und den konfigurierten Host
/ftp test                  Sendet einen Test-Invite für deinen eigenen aktuellen Nick
/ftpinvite                 Sendet einen FTP-Invite für deinen eigenen Nick
/ftpinvite <username>      Sendet einen FTP-Invite für einen bestimmten Benutzernamen
```

### Pro Netzwerk konfigurieren

Öffne **Netzwerk-Einstellungen → FTP Invite**, aktiviere es und setze:

- **FTP-Host**, **FTP-Port** (Standard 21)
- **FTP-Benutzername**, **FTP-Passwort**
- Schalter **FTP über explizites TLS (FTPS) verwenden**

Wenn aktiviert, kann der Client beim Verbinden auch automatisch einen Invite senden (vor dem Betreten der Channels).

### Funktion aktivieren

```js
ftpInvite: {
    enabled: true,
},
```

Ist es deaktiviert, wird der FTP-Bereich in der Oberfläche ausgeblendet und die Befehle `/ftp` / `/ftpinvite` werden abgelehnt.

## 🌍 Zeichensatz pro Nick

Manche User senden Nachrichten in einem anderen Zeichensatz als UTF-8. Du kannst die Dekodierung pro Nick überschreiben. Jeder von `iconv-lite` unterstützte Zeichensatz ist gültig.

### Befehle

```text
/encoding                      Listet alle konfigurierten Zeichensätze pro Nick auf
/encoding <nick>               Zeigt den aktuellen Zeichensatz für <nick>
/encoding <nick> <encoding>    Setzt einen Zeichensatz (z. B. utf8, latin1, cp1252, iso-8859-2, cp437)
/encoding <nick> auto          Setzt <nick> auf automatische Erkennung zurück
```

### Funktion aktivieren

```js
encoding: {
    enabled: true,
},
```

## 🌈 Zusätzliche Komfort-Befehle

```text
/rainbow <text>            Sendet <text> als bunten Regenbogen-IRC-Text
/rgb <text>                Alias für /rainbow
/mute [#chan ...]          Stummschalten des aktuellen Channels oder der aufgeführten Channels/Querys
/unmute [#chan ...]        Stummschaltung des aktuellen Channels oder der aufgeführten Channels/Querys aufheben
```

`/mute` und `/unmute` funktionieren auch im getrennten Zustand und übersteh­en Neustarts.

## Befehls-Schnellübersicht

| Befehl           | Aliase      | Zweck                                              |
| ---------------- | ----------- | -------------------------------------------------- |
| `/blow`          | —           | FiSH-Blowfish-Schlüssel setzen / löschen / anzeigen |
| `/keyexchange`   | `/ke`       | DH1080-Key-Exchange mit einem User                 |
| `/ftp`           | —           | FTP-Status anzeigen / Test-Invite senden           |
| `/ftpinvite`     | —           | FTP-`SITE INVITE` senden                           |
| `/encoding`      | —           | Zeichensatz pro Nick setzen                        |
| `/rainbow`       | `/rgb`      | Regenbogen-Text senden                             |
| `/mute`          | —           | Channel oder Query stummschalten                   |
| `/unmute`        | —           | Stummschaltung aufheben                            |

Zusätzlich bleiben alle Standard-Befehle von The Lounge verfügbar, darunter `/away`, `/ban`, `/connect`, `/ctcp`, `/disconnect`, `/ignore`, `/ignorelist`, `/invite`, `/join`, `/kick`, `/kill`, `/list`, `/mode`, `/msg`, `/nick`, `/notice`, `/part`, `/quit`, `/raw`, `/rejoin`, `/topic`, `/whois` sowie die clientseitigen `/collapse`, `/expand` und `/search`.

## Installation und Nutzung

The Lounge benötigt [Node.js](https://nodejs.org/) v24.11.1 oder neuer (empfohlen: Node.js v24 LTS oder v25+).
Der [Yarn-Paketmanager](https://yarnpkg.com/) v4.11.0+ wird ebenfalls empfohlen.
Bei der Installation mit npm ist `--unsafe-perm` für eine korrekte Installation erforderlich.

### Stabile Releases ausführen

Alle verfügbaren Installationsmethoden findest du in der [Installations- und Upgrade-Dokumentation auf der Upstream-Website](https://thelounge.chat/docs/install-and-upgrade). Ein Docker-Image für diesen Fork gibt es unter [LordBex/thelounge-docker](https://github.com/LordBex/thelounge-docker).

### Aus dem Quellcode ausführen

Die folgenden Befehle installieren und starten die Entwicklungsversion dieses Forks:

```sh
git clone https://github.com/LordBex/thelounge.git
cd thelounge
yarn install
NODE_ENV=production yarn build
yarn start
```

Bei dieser Installationsart wird kein `thelounge`-Executable erstellt. Verwende `node index <command>`, um Befehle auszuführen.

Bearbeite nach dem ersten Start deine `config.js` (im konfigurierten `THELOUNGE_HOME`), um die Fork-Funktionen ein- oder auszuschalten:

```js
fish:       { enabled: true, allowKeyExchange: true },
ftpInvite:  { enabled: true },
encoding:   { enabled: true },
```

⚠️ Auch wenn es der aktuellste Code ist — er ist nicht produktionsreif! Nutzung auf eigenes Risiko. Es wird außerdem davon abgeraten, ihn als root auszuführen.

## Entwicklungs-Setup

Folge einfach der obigen Anleitung, um The Lounge aus dem Quellcode in deinem eigenen Fork auszuführen.

Bevor du eine Änderung einreichst, stelle sicher, dass du:

- die [Contributing-Hinweise](https://github.com/LordBex/thelounge/blob/master/.github/CONTRIBUTING.md#contributing) liest
- `yarn test` ausführst, um Linter und Testsuite laufen zu lassen
  - `yarn format:prettier` ausführst, falls das Linting fehlschlägt
- `yarn build:client` ausführst, wenn du etwas in `client/js` oder `client/components` änderst oder hinzufügst
  - Die gebauten Dateien werden von webpack nach `public/` geschrieben
- `yarn build:server` ausführst, wenn du etwas in `server/` änderst
  - Die gebauten Dateien werden von tsc nach `dist/` geschrieben
- `yarn dev` kann verwendet werden, um The Lounge mit Hot Module Reloading zu starten

Damit du keine Dateien committest, die das Linting nicht bestehen, kannst du einen Pre-Commit-Git-Hook installieren.
Führe dazu `yarn githooks-install` aus.

## Credits & Lizenz

Dieser Fork baut auf [The Lounge](https://github.com/thelounge/thelounge) auf und übernimmt dessen Lizenz (siehe [`LICENSE`](LICENSE)). Die DH1080-Implementierung ist aus WeeChats `fish.py` von Bjorn Edstrom portiert. Die vollständige Liste der Beitragenden zum Upstream-Projekt findest du in [`CREDITS.md`](CREDITS.md).

---

