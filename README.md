# 🤖 Bot Discord — Système PV

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

1. Renomme `.env.example` en `.env`
2. Mets ton token Discord dedans :
```
DISCORD_TOKEN=ton_token_ici
```

## 🚀 Lancer le bot

```bash
node index.js
# ou avec nodemon (auto-reload)
npm run dev
```

---

## 🔑 Permissions bot nécessaires (Discord Developer Portal)

Dans **Bot → Privileged Gateway Intents**, active :
- ✅ `SERVER MEMBERS INTENT`
- ✅ `MESSAGE CONTENT INTENT`
- ✅ `PRESENCE INTENT`

Dans les **permissions d'invitation** :
- `Manage Channels` (optionnel)
- `Move Members`
- `Mute Members`
- `Read Messages / Send Messages`
- `Embed Links`

---

## 📋 Commandes

| Commande | Description | Qui |
|----------|-------------|-----|
| `=help` | Liste toutes les commandes | Tout le monde |
| `=pv` | Toggle privé/public sur ton vocal actuel | Tout le monde (propriétaire du salon) |
| `=acces @user` | Donne/retire accès au salon PV | Propriétaire du salon |
| `=mv @user` | Déplace un membre dans ton vocal | Tout le monde |
| `=menotte @user` | Mute/unmute serveur un membre | Staff (MuteMembers) |
| `=ui [@user]` | Infos complètes d'un membre | Tout le monde |
| `=wl @user` | Ajoute/retire un membre de la whitelist PV globale | Owner uniquement |
| `=pvsys @user` | Donne/retire l'accès à la PV système | Owner uniquement |

---

## 🏗️ Système PV expliqué

### PV classique (`=pv` + `=acces`)
- N'importe qui dans un vocal peut faire `=pv` pour le rendre **privé**
- Il devient le **propriétaire** du salon
- Il peut ensuite faire `=acces @user` pour autoriser des gens spécifiques
- Quiconque rejoint sans être dans la liste est **automatiquement éjecté**

### PV Système (`=pvsys`)
- Réservé aux **owners** du serveur (rôle `owner` ou propriétaire du serveur)
- Les membres avec accès PvSys peuvent toggle le PV de **n'importe quel salon**
- Ils ne sont jamais éjectés des salons privés

### Whitelist globale (`=wl`)
- Réservée aux owners
- Un membre en whitelist peut rejoindre **tous les salons PV** sans restriction

---

## 📁 Données

Les données sont sauvegardées dans `data.json` :
```json
{
  "pvChannels": { "channelId": { "channelId": "...", "ownerId": "...", "isPrivate": true } },
  "accessLists": { "channelId": ["userId1", "userId2"] },
  "whitelist": ["userId1"],
  "pvSysOwners": ["userId1"]
}
```
