const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ]
});

// ─────────────────────────────────────────────
//  STORAGE  (fichier JSON simple)
// ─────────────────────────────────────────────
const DB_FILE = './data.json';

function loadData() {
  if (!fs.existsSync(DB_FILE)) return { pvChannels: {}, accessLists: {}, whitelist: [], pvSysOwners: [] };
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { pvChannels: {}, accessLists: {}, whitelist: [], pvSysOwners: [] }; }
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const PREFIX = '=';

const BOT_OWNER_ID = '1332762903970844712'; // Big boss

function isOwner(member) {
  const data = loadData();
  if (member.id === BOT_OWNER_ID) return true;
  if (member.guild.ownerId === member.id) return true;
  if ((data.owners || []).includes(member.id)) return true;
  return member.roles.cache.some(r => r.name.toLowerCase() === 'owner');
}

function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const day = d.getDate();
  const month = d.toLocaleString('fr-FR', { month: 'long' });
  const year = d.getFullYear();

  let relative;
  if (diffDays === 0) relative = "aujourd'hui";
  else if (diffDays === 1) relative = 'il y a 1 jour';
  else if (diffDays < 31) relative = `il y a ${diffDays} jours`;
  else if (diffMonths === 1) relative = 'il y a 1 mois';
  else if (diffMonths < 12) relative = `il y a ${diffMonths} mois`;
  else if (diffYears === 1) relative = 'il y a 1 an';
  else relative = `il y a ${diffYears} ans`;

  return `${day} ${month} ${year} ( ${relative} )`;
}

function getPlatform(member) {
  const status = member.presence;
  if (!status) return 'Inconnue';
  if (status.clientStatus?.desktop) return 'Ordinateur';
  if (status.clientStatus?.mobile) return 'Mobile';
  if (status.clientStatus?.web) return 'Web';
  return 'Inconnue';
}

function getStatus(member) {
  const presence = member.presence;
  if (!presence || presence.status === 'offline') return '⚫ Hors ligne';
  const icons = { online: '🟢 En ligne', idle: '🌙 Absent', dnd: '⛔ Ne pas déranger' };
  return icons[presence.status] || presence.status;
}

function getActivity(member) {
  const presence = member.presence;
  if (!presence || !presence.activities.length) return '—';
  const act = presence.activities[0];
  if (act.name === 'Custom Status') return act.state || '—';
  return act.name || '—';
}

// ─────────────────────────────────────────────
//  EVENTS
// ─────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

// Quand quelqu'un rejoint un vocal → vérifier whitelist si c'est un salon PV
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!newState.channelId) return; // déconnexion
  const data = loadData();
  const channel = newState.channel;
  if (!channel) return;

  // Chercher si ce salon est un PV
  const pvEntry = Object.values(data.pvChannels).find(pv => pv.channelId === channel.id);
  if (!pvEntry) return;
  if (!pvEntry.isPrivate) return; // salon public → rien à faire

  const member = newState.member;
  const accessList = data.accessLists[channel.id] || [];
  const wl = data.whitelist || [];

  // Owner bypass
  if (isOwner(member)) return;
  // PvSys owners bypass
  if (data.pvSysOwners && data.pvSysOwners.includes(member.id)) return;
  // Check access
  if (accessList.includes(member.id) || wl.includes(member.id)) return;

  // Éjecter
  try {
    await member.voice.disconnect('Accès refusé au salon privé');
    await member.send(`❌ Tu n'as pas accès au salon vocal **${channel.name}**.`).catch(() => {});
  } catch {}
});

// ─────────────────────────────────────────────
//  COMMANDES
// ─────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const member = message.member;
  const data = loadData();

  // ──────── =ow ────────
  if (command === 'ow') {
    // Seul le vrai propriétaire du serveur peut utiliser =ow
    if (message.guild.ownerId !== member.id) {
      return message.reply({ embeds: [errorEmbed('Seul le propriétaire du serveur peut utiliser cette commande.')] });
    }

    const target = message.mentions.members.first() || (args[0] ? message.guild.members.cache.get(args[0]) : null);
    if (!target) {
      return message.reply({ embeds: [errorEmbed('Veuillez mentionner un membre valide.')] });
    }

    if (!data.owners) data.owners = [];

    if (data.owners.includes(target.id)) {
      data.owners = data.owners.filter(id => id !== target.id);
      saveData(data);
      return message.reply({ embeds: [successEmbed(`✅ **${target.user.tag}** n'est plus owner.`)] });
    }

    data.owners.push(target.id);
    saveData(data);
    return message.reply({ embeds: [successEmbed(`✅ **${target.user.tag}** est maintenant **owner** 👑`)] });
  }

  // ──────── =help ────────
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 Commandes disponibles')
      .addFields(
        { name: '`=pv`', value: 'Rend votre salon vocal **privé** ou **public**', inline: false },
        { name: '`=acces @user`', value: 'Donne accès à votre salon PV à un membre', inline: false },
        { name: '`=mv @user`', value: 'Déplace un membre dans votre vocal', inline: false },
        { name: '`=menotte @user`', value: 'Empêche un membre de parler/rejoindre', inline: false },
        { name: '`=ui [@user]`', value: 'Affiche les infos d\'un membre', inline: false },
        { name: '`=ow @user`', value: '[Proprio serveur] Donne/retire le statut owner', inline: false },
        { name: '`=pvsys @user`', value: '[Owner] Donne accès à la PV système', inline: false },
      )
      .setFooter({ text: 'Préfixe : =' });

    return message.reply({ embeds: [embed] });
  }

  // ──────── =pv ────────
  if (command === 'pv') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('Vous devez être dans un salon vocal.')] });
    }

    const channelId = voiceChannel.id;
    if (!data.pvChannels[channelId]) {
      data.pvChannels[channelId] = { channelId, ownerId: member.id, isPrivate: false };
    }

    const pv = data.pvChannels[channelId];

    // Seul le propriétaire du salon ou un owner peut toggle
    if (pv.ownerId !== member.id && !isOwner(member) && !(data.pvSysOwners || []).includes(member.id)) {
      return message.reply({ embeds: [errorEmbed("Ce n'est pas votre salon vocal.")] });
    }

    pv.isPrivate = !pv.isPrivate;
    saveData(data);

    const icon = pv.isPrivate ? '🔒' : '🌐';
    const label = pv.isPrivate ? 'privé' : 'public';
    const color = pv.isPrivate ? 0xe74c3c : 0x2ecc71;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(`✅ **${voiceChannel.name}** est désormais **${label}** ${icon}`);

    return message.reply({ embeds: [embed] });
  }

  // ──────── =acces ────────
  if (command === 'acces') {
    const target = message.mentions.members.first() || (args[0] ? message.guild.members.cache.get(args[0]) : null);
    if (!target) {
      return message.reply({ embeds: [errorEmbed('Veuillez mentionner un utilisateur ou fournir un ID valide.')] });
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('Vous devez être dans un salon vocal.')] });
    }

    const channelId = voiceChannel.id;
    if (!data.accessLists[channelId]) data.accessLists[channelId] = [];

    if (data.accessLists[channelId].includes(target.id)) {
      // Retirer l'accès
      data.accessLists[channelId] = data.accessLists[channelId].filter(id => id !== target.id);
      saveData(data);
      return message.reply({ embeds: [successEmbed(`✅ Accès **retiré** à ${target.user.tag} pour ce salon.`)] });
    }

    data.accessLists[channelId].push(target.id);
    saveData(data);
    return message.reply({ embeds: [successEmbed(`✅ ${target.user.tag} a maintenant accès au salon **${voiceChannel.name}**.`)] });
  }

  // ──────── =mv ────────
  if (command === 'mv') {
    const target = message.mentions.members.first() || (args[0] ? message.guild.members.cache.get(args[0]) : null);
    if (!target) {
      return message.reply({ embeds: [errorEmbed('Veuillez fournir un membre valide (mention ou ID).')] });
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return message.reply({ embeds: [errorEmbed('Vous devez être dans un salon vocal pour déplacer quelqu\'un.')] });
    }

    if (!target.voice.channel) {
      return message.reply({ embeds: [errorEmbed(`${target.user.tag} n'est pas dans un salon vocal.`)] });
    }

    try {
      await target.voice.setChannel(voiceChannel);
      return message.reply({ embeds: [successEmbed(`✅ **${target.user.tag}** a été déplacé dans **${voiceChannel.name}**.`)] });
    } catch {
      return message.reply({ embeds: [errorEmbed('Impossible de déplacer ce membre (permissions insuffisantes).')] });
    }
  }

  // ──────── =menotte ────────
  if (command === 'menotte') {
    const target = message.mentions.members.first() || (args[0] ? message.guild.members.cache.get(args[0]) : null);
    if (!target) {
      return message.reply({ embeds: [errorEmbed('Veuillez mentionner un membre valide.')] });
    }

    // Vérifier les permissions
    if (!member.permissions.has(PermissionFlagsBits.MuteMembers) && !isOwner(member)) {
      return message.reply({ embeds: [errorEmbed('Vous n\'avez pas la permission de menotter des membres.')] });
    }

    try {
      const isMuted = target.voice.serverMute;
      await target.voice.setMute(!isMuted);
      const action = !isMuted ? 'menotté 🔇' : 'démenotté 🔊';
      return message.reply({ embeds: [successEmbed(`✅ **${target.user.tag}** a été ${action}.`)] });
    } catch {
      return message.reply({ embeds: [errorEmbed('Impossible de menotter ce membre. Il doit être en vocal.')] });
    }
  }

  // ──────── =ui ────────
  if (command === 'ui') {
    const target = message.mentions.members.first()
      || (args[0] ? message.guild.members.cache.get(args[0]) : null)
      || member;

    // Fetch pour avoir la présence
    let targetMember;
    try {
      targetMember = await message.guild.members.fetch({ user: target.id, force: true });
    } catch {
      targetMember = target;
    }

    const user = targetMember.user;
    const voiceState = targetMember.voice;
    const voiceChannel = voiceState?.channel;

    // Vocal info
    let vocalText = 'Aucun salon vocal';
    let doingText = '—';
    if (voiceChannel) {
      vocalText = `${voiceChannel.name}`;
      doingText = 'Rien faire'; // Pas d'activité spécifique au vocal
    }

    // Rôles (sauf @everyone)
    const roles = targetMember.roles.cache
      .filter(r => r.id !== message.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .slice(0, 10)
      .join(' ') || 'Aucun rôle';

    const platform = getPlatform(targetMember);
    const statusStr = getStatus(targetMember);
    const activity = getActivity(targetMember);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(user.displayAvatarURL({ size: 256, dynamic: true }))
      .addFields(
        {
          name: 'Compte',
          value: `**@${user.username}**`,
          inline: false
        },
        {
          name: 'Informations',
          value: `**Pseudo :** ${targetMember.nickname || user.username}\n**Id :** \`${user.id}\``,
          inline: true
        },
        {
          name: 'Activité/Statut',
          value: `**Statut :** ${statusStr}\n**Plateforme :** ${platform}\n**Activité :**\n${activity}`,
          inline: true
        },
        {
          name: 'Vocal',
          value: voiceChannel
            ? `**Salon :** ${voiceChannel.name}\nIl est en train de : **${doingText}**`
            : '**Salon :** Aucun vocal',
          inline: false
        },
        {
          name: 'Dates',
          value: `**Créé :** ${formatDate(user.createdAt)}\n**Rejoint :** ${formatDate(targetMember.joinedAt)}`,
          inline: false
        },
        {
          name: 'Rôles',
          value: roles,
          inline: false
        }
      );

    return message.reply({ embeds: [embed] });
  }

  // ──────── =wl (whitelist globale PV — réservé owners) ────────
  if (command === 'wl') {
    if (!isOwner(member)) {
      return message.reply({ embeds: [errorEmbed('Seuls les owners peuvent utiliser cette commande.')] });
    }

    const target = message.mentions.members.first() || (args[0] ? message.guild.members.cache.get(args[0]) : null);
    if (!target) {
      return message.reply({ embeds: [errorEmbed('Veuillez mentionner un membre valide.')] });
    }

    if (!data.whitelist) data.whitelist = [];

    if (data.whitelist.includes(target.id)) {
      data.whitelist = data.whitelist.filter(id => id !== target.id);
      saveData(data);
      return message.reply({ embeds: [successEmbed(`✅ **${target.user.tag}** a été retiré de la whitelist PV.`)] });
    }

    data.whitelist.push(target.id);
    saveData(data);
    return message.reply({ embeds: [successEmbed(`✅ **${target.user.tag}** a été ajouté à la whitelist PV globale.`)] });
  }

  // ──────── =pvsys (donner accès à la PV système — réservé owners) ────────
  if (command === 'pvsys') {
    if (!isOwner(member)) {
      return message.reply({ embeds: [errorEmbed('Seuls les owners peuvent utiliser cette commande.')] });
    }

    const target = message.mentions.members.first() || (args[0] ? message.guild.members.cache.get(args[0]) : null);
    if (!target) {
      return message.reply({ embeds: [errorEmbed('Veuillez mentionner un membre valide.')] });
    }

    if (!data.pvSysOwners) data.pvSysOwners = [];

    if (data.pvSysOwners.includes(target.id)) {
      data.pvSysOwners = data.pvSysOwners.filter(id => id !== target.id);
      saveData(data);
      return message.reply({ embeds: [successEmbed(`✅ **${target.user.tag}** n'a plus accès à la PV système.`)] });
    }

    data.pvSysOwners.push(target.id);
    saveData(data);
    return message.reply({ embeds: [successEmbed(`✅ **${target.user.tag}** a maintenant accès à la PV système.`)] });
  }
});

// ─────────────────────────────────────────────
//  EMBED HELPERS
// ─────────────────────────────────────────────
function errorEmbed(text) {
  return new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ ${text}`);
}

function successEmbed(text) {
  return new EmbedBuilder().setColor(0x2ecc71).setDescription(text);
}

// ─────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant dans .env');
  process.exit(1);
}
client.login(TOKEN);
