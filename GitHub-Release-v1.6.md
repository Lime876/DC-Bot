# 📦 Release: vX.X.X – 2025-07-18

## 🆕 Neue Features
- `changelog`-Command hinzugefügt (`commands/General/changelog.js`)
- `autotimeout`-System eingeführt (`commands/Moderation/autotimeout.js`, `utils/autotimeoutConfig.js`, `utils/timeoutUtils.js`)
- `autorole-Lime.js` für individuelle Auto-Rollen-Funktion hinzugefügt
- Neue Event-Handler:
  - `channelUpdate`, `guildBanAdd`, `guildBanRemove`
  - `roleCreate`, `roleDelete`
  - `ticketSystem` (eventbasiertes Ticketsystem)

## ⚙️ Verbesserungen & Änderungen
- `help.js` überarbeitet
- Kalender-, Kick-, Timeout-, Poll- und weitere Moderations-Commands aktualisiert
- Invite-Tracker, JTC Setup, Voting und weitere Admin-Commands verbessert
- Wirtschaftssystem (Economy) verbessert:
  - Balancing & neue Funktionen für `pay`, `rob`, `work` etc.
- Utility-Kommandos (z. B. `botinfo`, `weather`, `serverinfo`) verbessert
- Sprachdateien `de.json` und `en.json` erweitert
- Diverse Events wie `messageCreate`, `guildMemberAdd`, `reactionAdd` etc. verbessert

## 🗃️ Datenstruktur & Config-Updates
- Neue Konfigurationsdateien:
  - `utils/configUtils.js`
  - `utils/timeoutUtils.js`
- Alte JSON-Dateien ersetzt oder gelöscht:
  - `data/spamConfigs.json` → integriert in `spamconfig.js`
  - `data/logChannels.json` gelöscht → ersetzt durch `logchannels.json`

## 🧱 Interne Änderungen
- Logging verbessert (`utils/logger.js`, `logUtils.js`)
- `sharedState.js`, `watcher.js` und `languageUtils.js` aktualisiert
- Neue Discord-API-Typen als Abhängigkeit hinzugefügt (`.discord-api-types-6OVLh30b/`)

---

🔧 **Hinweis:** Vergiss nicht, nach dem Update deine Konfigurationsdateien ggf. zu überprüfen und neue Abhängigkeiten mit `npm install` zu installieren.
