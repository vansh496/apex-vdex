/* ============================================================
   VDEX COP — data.js
   Saara mock/sample data. Real backend se jodne ke liye sirf
   yahi file replace karna hai.
   ============================================================ */

window.DB = (function () {
  'use strict';

  /* ---------------------------------------------------------
     SERVER
     --------------------------------------------------------- */
  const server = {
    id: '1545770371129811044',
    name: 'APEX CHEATS',
    icon: 'A',
    owner: 'Omir',
    ownerId: '790283746510293517',
    createdAt: '2023-04-12',
    boostTier: 3,
    boostCount: 14,
    region: 'India (Mumbai)',
    verifyLevel: 'High',
    locale: 'English (IN)',
    online: 109,
    members: 4268,
    channels: 38,
    roles: 61,
    emojis: 142,
    webhooks: 4,
    banned: 218,
    mutes: 12,
    warns: 47,
    invite: 'https://discord.gg/HKTNOW',
    supportServer: 'https://discord.gg/example',
    uptime: '99.98%',
    latency: 42,
  };

  /* ---------------------------------------------------------
     MODULE REGISTRY — sidebar + overview cards
     --------------------------------------------------------- */
  const modules = [
    // ---- group: core ----
    { key: 'overview',        name: 'Overview',          icon: '\u{1F4CA}', group: 'Core',      desc: 'Server health, stats and quick actions at a glance.' },
    { key: 'customization',   name: 'Customization',     icon: '\u{1F3A8}', group: 'Core',      desc: 'Server name, icon, banner, splash and general appearance.' },
    { key: 'verification',    name: 'Verification',      icon: '\u{2705}', group: 'Core',      desc: 'Entry gate, captcha, role-gating and access rules.' },
    { key: 'servermgmt',      name: 'Server Management', icon: '\u{1F5C2}', group: 'Core',      desc: 'Server profile, ownership, invites and audit trail.' },

    // ---- group: moderation ----
    { key: 'antinuke',        name: 'Anti-Nuke',         icon: '\u{1F6E1}', group: 'Moderation', desc: 'Stops mass raids and nukes. Sirf server owner safe hai — admin ko bhi ban lagti hai.' },
    { key: 'scam',            name: 'Scam Protection',   icon: '\u{1F6E8}', group: 'Moderation', desc: 'Detects phishing links, fake giveaways and impersonation.' },

    // ---- group: engagement ----
    { key: 'welcome',         name: 'Welcome',           icon: '\u{1F44B}', group: 'Engagement', desc: 'Greet new members with cards, images or embeds.' },

    // ---- group: messaging ----
    { key: 'embedbuilder',    name: 'Embed Builder',     icon: '\u{1F4A1}', group: 'Messaging',  desc: 'Design rich embeds with a live Discord preview.' },
    { key: 'stickymessages',  name: 'Sticky Messages',   icon: '\u{1F9F0}', group: 'Messaging',  desc: 'Pin a persistent message to a channel.' },
    { key: 'joindm',          name: 'Join DM',           icon: '\u{2709}', group: 'Messaging',  desc: 'Send a DM with rules to every new member.' },

    // ---- group: tickets ----
    { key: 'tickets',         name: 'Tickets',           icon: '\u{1F3AB}', group: 'Tickets',    desc: 'Support ticket system with categories and transcripts.' },
  ];

  const groups = ['Core', 'Moderation', 'Engagement', 'Messaging', 'Tickets'];

  /* ---------------------------------------------------------
     CHANNELS
     --------------------------------------------------------- */
  const channels = [
    { id: 'c1',  name: 'general',       type: 'text',   cat: 'Text Channels', members: 104 },
    { id: 'c2',  name: 'welcome',       type: 'text',   cat: 'Text Channels', members: 102 },
    { id: 'c3',  name: 'rules',         type: 'text',   cat: 'Text Channels', members: 103 },
    { id: 'c4',  name: 'announcements', type: 'news',   cat: 'Text Channels', members: 98 },
    { id: 'c5',  name: 'showcase',      type: 'text',   cat: 'Text Channels', members: 96 },
    { id: 'c6',  name: 'counting',      type: 'text',   cat: 'Text Channels', members: 88 },
    { id: 'c7',  name: 'bot-updates',   type: 'news',   cat: 'Text Channels', members: 101 },
    { id: 'c8',  name: 'tickets',       type: 'text',   cat: 'Support',       members: 21 },
    { id: 'c9',  name: 'ticket-logs',   type: 'text',   cat: 'Support',       members: 6 },
    { id: 'c10', name: 'staff-chat',    type: 'text',   cat: 'Staff',         members: 9 },
    { id: 'c11', name: 'staff-reports', type: 'text',   cat: 'Staff',         members: 5 },
    { id: 'c12', name: 'General Voice', type: 'voice',  cat: 'Voice',         members: 34 },
    { id: 'c13', name: 'Gaming',        type: 'voice',  cat: 'Voice',         members: 18 },
  ];

  const categories = [
    'Text Channels', 'Support', 'Staff', 'Voice',
  ];

  /* ---------------------------------------------------------
     ROLES
     --------------------------------------------------------- */
  const roles = [
    { id: 'r1',  name: 'Owner',            color: '#f1c40f', members: 1,   hoisted: true,  mentionable: false, staff: true },
    { id: 'r2',  name: 'Admin',            color: '#e74c3c', members: 3,   hoisted: true,  mentionable: true,  staff: true },
    { id: 'r3',  name: 'Moderator',        color: '#3498db', members: 8,   hoisted: true,  mentionable: true,  staff: true },
    { id: 'r4',  name: 'Support',          color: '#2ecc71', members: 11,  hoisted: false, mentionable: true,  staff: true },
    { id: 'r5',  name: 'Helper',           color: '#9b59b6', members: 6,   hoisted: false, mentionable: true,  staff: true },
    { id: 'r6',  name: 'Premium',          color: '#e67e22', members: 47,  hoisted: false, mentionable: true,  staff: false },
    { id: 'r7',  name: 'VIP',              color: '#1abc9c', members: 23,  hoisted: false, mentionable: true,  staff: false },
    { id: 'r8',  name: 'Gamer',            color: '#e84393', members: 164, hoisted: false, mentionable: true,  staff: false },
    { id: 'r9',  name: 'Muted',            color: '#95a5a6', members: 12,  hoisted: false, mentionable: false, staff: false },
    { id: 'r10', name: 'Banned',           color: '#c0392b', members: 218, hoisted: false, mentionable: false, staff: false },
    { id: 'r11', name: 'Booster',          color: '#c0392b', members: 14,  hoisted: false, mentionable: true,  staff: false },
    { id: 'r12', name: 'Level 20',         color: '#f39c12', members: 32,  hoisted: false, mentionable: false, staff: false },
    { id: 'r13', name: 'Level 10',         color: '#f1c40f', members: 68,  hoisted: false, mentionable: false, staff: false },
    { id: 'r14', name: 'Contributor',      color: '#16a085', members: 29,  hoisted: false, mentionable: true,  staff: false },
  ];

  /* ---------------------------------------------------------
     MEMBERS
     --------------------------------------------------------- */
  const firstNames = ['Omir','Sneha','Reece','Gerton','Wilson','AmberFlame','Crimson','Vinitose','Dhruva','Tumsee',
                      'Cannon','Scion','Power','Cierra','Aether','Karma','Loki','Zeno','Nova','Echo',
                      'Riven','Blitz','Phantom','Vex','Astra','Jett','Sage','Raze','Wraith','Neon'];
  const lastNames  = ['Patel','Shah','Verma','Gupta','Singh','Kumar','Reddy','Nair','Joshi','Mehta',
                      'Iyer','Rao','Desai','Chopra','Bose','Gill','Khan','Das','Roy','Kapoor'];

  const members = Array.from({ length: 34 }, (_, i) => {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i * 7 + 3) % lastNames.length];
    const joined = new Date(2023, 3 + (i % 20), 1 + (i % 27));
    const roleIdx = i === 0 ? 0 : (i < 4 ? 1 : (i < 12 ? 2 : (i < 23 ? 3 : 6)));
    return {
      id: 'u' + (154000000000000000 + i * 7919),
      tag: `${fn}#${1000 + i}`,
      name: fn,
      display: `${fn} ${ln}`,
      color: ['#e74c3c','#3498db','#2ecc71','#9b59b6','#e67e22','#1abc9c'][i % 6],
      level: Math.max(1, 42 - i),
      xp: Math.max(120, 9840 - i * 260),
      messages: Math.max(4, 512 - i * 14),
      joined: joined.toISOString().slice(0, 10),
      role: roles[roleIdx].name,
      roleId: roles[roleIdx].id,
      boosting: i % 9 === 0,
      status: i % 4 === 0 ? 'online' : (i % 7 === 0 ? 'idle' : 'offline'),
    };
  });

  /* ---------------------------------------------------------
     AUDIT LOG
     --------------------------------------------------------- */
  const auditLog = [
    { t: '2026-09-29 16:42', who: 'Omir',      event: 'Banned user',       detail: '@xXScammerXx banned by Omir — New account raid', type: 'ban' },
    { t: '2026-09-29 16:30', who: 'Gerton',    event: 'Message deleted',    detail: 'Deleted message by @FreeWin in #general', type: 'delete' },
    { t: '2026-09-29 16:18', who: 'Moderator', event: 'Timeout 10m',        detail: '@Spammer99 timed out in #general', type: 'warn' },
    { t: '2026-09-29 15:55', who: 'Scion',     event: 'Role updated',       detail: 'Added role Premium to @Sneha', type: 'role' },
    { t: '2026-09-29 15:40', who: 'VDEX COP',  event: 'Auto action',        detail: 'Anti-nuke blocked mass channel delete (2 deletes)', type: 'system' },
    { t: '2026-09-29 15:22', who: 'Sneha',     event: 'Joined server',      detail: 'Joined via Premium Server', type: 'join' },
    { t: '2026-09-29 14:58', who: 'Omir',      event: 'Server boost',       detail: 'Tier 3 boost by @AmberFlame', type: 'boost' },
    { t: '2026-09-29 14:31', who: 'VDEX COP',  event: 'Automod action',     detail: 'Blocked invite link in #general (3 matches)', type: 'system' },
    { t: '2026-09-29 14:02', who: 'Reece',     event: 'Warned user',        detail: '@ToxicKid warned — 2nd offence (slur filter)', type: 'warn' },
    { t: '2026-09-29 13:47', who: 'Gerton',    event: 'Channel created',    detail: 'Created #ticket-logs', type: 'channel' },
  ];

  /* ---------------------------------------------------------
     PER-MODULE DEFAULT CONFIG
     --------------------------------------------------------- */
  const config = {
    /* ---- customization ---- */
    customization: {
      serverName: 'APEX CHEATS',
      description: 'The best Apex Legends cheat community. Premium support, instant delivery.',
      accentColor: '#7c5cff',
      banner: 'https://cdn.discordapp.com/banners/1545770371129811044/a1b2c3.png',
      botName: '',                        /* is server me bot ka naam (nickname) — khali = asli naam */
      botUsername: '',                    /* poore Discord ka username — khali = mat chhoo (2 badle/ghante) */
      botAvatar: '',                      /* bot ki DP — image URL/message link; 'reset' = wapas default */
      botBanner: '',                      /* profile banner — wahi rules; 'reset' = banner hatao */
      splash: 'level',
      systemChannel: 'c4',
      rulesChannel: 'c3',
      publicUpdates: 'c7',
      defaultNotifications: 'c1',
      vanityURL: '',
    },

    /* ---- verification ---- */
    verification: {
      enabled: true,
      mode: 'captcha',
      gateChannel: 'c2',
      minAccountAge: '3',
      minServerAge: '0',
      allowRoleRecheck: true,
      captchaType: 'image',
      captchaDifficulty: 'medium',
      verifyTimeout: '10',
      checkAlt: false,
      checkSpam: true,
      autoRole: 'r5',
      kickOnFail: false,
      entryMessage: 'Welcome! To protect this community from automated raids and unauthorized access, please verify yourself before unlocking the rest of the server.',
      buttonLabel: 'Verify me',
      roleToAssign: 'r5',
      challengeMethod: 'captcha',
    },

    /* ---- anti-nuke ---- */
    /* ---- server management (server profile Discord par apply hoti hai) ---- */
    servermgmt: {
      enabled: true,
      name: '',                       /* khali = server ka naam mat chhuo */
      description: '',
      verificationLevel: 'medium',    /* none | low | medium | high | highest */
      defaultNotifications: 'mentions', /* all | mentions */
      afkTimeout: 300,                /* 60 / 300 / 900 / 1800 / 3600 sec */
      afkChannel: '',
    },

    antinuke: {
      enabled: true,
      action: 'ban',
      whitelistAdmins: false,
      whitelistUsers: [],
      whitelistRoles: [],
      protectedUsers: [],
      protectedRoles: [],
      protectedChannels: [],
      restoreChannels: false,
      restoreRoles: false,
      timeoutMinutes: 15,
      lockdownMinutes: 30,
      thresholds: [
        /* limit: 1 = pehle hi action par trip (koi time/counting wait nahi) */
        { id: 't1', event: 'Channel Delete', limit: 1,  window: '5s',  action: 'Ban',  on: true },
        { id: 't2', event: 'Channel Create', limit: 1,  window: '10s', action: 'Ban',  on: true },
        { id: 't3', event: 'Role Create',    limit: 1,  window: '10s', action: 'Ban',  on: true },
        { id: 't4', event: 'Role Delete',    limit: 1,  window: '10s', action: 'Ban',  on: true },
        { id: 't5', event: 'Mass Ban',       limit: 1,  window: '10s', action: 'Ban',  on: true },
        { id: 't6', event: 'Webhook Create', limit: 1,  window: '10s', action: 'Kick', on: true },
        { id: 't7', event: 'Permission Grant',limit: 1, window: '5s',  action: 'Ban',  on: true },
      ],
      alerts: true,
      logChannel: 'c11',
    },

    /* ---- automod ---- */
    automod: {
      enabled: true,
      action: 'delete',
      logChannel: 'c11',
      punishChannel: 'c11',
      filters: [
        { id: 'f1', name: 'Profanity / Slurs', trigger: 'Keyword list',  words: '69, fag, retarded, idiot', action: 'Delete + Warn', on: true,  hits: 41 },
        { id: 'f2', name: 'Discord Invites',   trigger: 'discord.gg',    words: 'discord.gg, discord.com/invite, discordapp.com/invite', action: 'Delete + Warn', on: true, hits: 128 },
        { id: 'f3', name: 'Spam / Mention Mass', trigger: 'Mentions > 5', words: '', action: 'Delete + Timeout 10m', on: true, hits: 17 },
        { id: 'f4', name: 'Caps Spam',         trigger: '> 70% caps, > 12 chars', words: '', action: 'Delete', on: true, hits: 63 },
        { id: 'f5', name: 'External Links',    trigger: 'URL',           words: 'exe, bat, apk, rar, zip', action: 'Delete + Warn', on: true, hits: 9 },
        { id: 'f6', name: 'Zalgo / Spam Chars',trigger: 'Unicode abuse', words: '', action: 'Delete', on: false, hits: 0 },
      ],
    },

    /* ---- scam ---- */
    scam: {
      enabled: true,
      action: 'quarantine',
      checkPhishing: true,
      checkFreeNitro: true,
      checkImpersonation: true,
      checkGiveawayFake: true,
      checkExternal: true,
      logChannel: 'c11',
      alerts: true,
      quarantined: 34,
      blockedLinks: 112,
    },

    /* ---- logging ---- */
    logging: {
      enabled: true,
      logChannel: 'c11',
      events: [
        { id: 'e1', name: 'Message Events',   sub: 'Delete, Edit, Bulk Delete',   on: true,  target: 'c11' },
        { id: 'e2', name: 'Member Events',   sub: 'Join, Leave, Kick, Ban',      on: true,  target: 'c11' },
        { id: 'e3', name: 'Role Changes',    sub: 'Create, Delete, Assign',      on: true,  target: 'c11' },
        { id: 'e4', name: 'Channel Events',  sub: 'Create, Delete, Edit',        on: true,  target: 'c11' },
        { id: 'e5', name: 'Voice Events',    sub: 'Join, Leave, Move',           on: false, target: 'c11' },
        { id: 'e6', name: 'Message Edits',   sub: 'Old vs new content',          on: true,  target: 'c11' },
        { id: 'e7', name: 'Raid / Anti-Nuke',sub: 'Threshold trips',            on: true,  target: 'c11' },
        { id: 'e8', name: 'Booster Events',  sub: 'Boost, unboost',              on: false, target: 'c11' },
      ],
      ignoreBots: true,
      ignoreChannels: ['c10', 'c12', 'c13'],
    },

    /* ---- welcome ---- */
    welcome: {
      enabled: true,
      channel: 'c2',
      type: 'card',
      dmOnJoin: true,
      showAccountAge: true,
      showInviteSource: true,
      showMemberCount: true,
      message: 'Welcome to {server}!\n\nMake sure to read the rules, introduce yourself, and enjoy your time with us.',
      cardTitle: 'Welcome to Apple Community',
      cardSub: 'Enjoy your stay, {user}',
      image: '',
      thumbnail: '',
      mentionRole: 'r5',
    },

    /* ---- farewell ---- */
    farewell: {
      enabled: false,
      channel: 'c2',
      type: 'embed',
      dmOnLeave: false,
      message: '{user} has left the server. We are now **{count}** members.',
      showMemberCount: true,
      showTimeLeft: true,
    },

    /* ---- leveling ---- */
    leveling: {
      enabled: true,
      channel: 'c1',
      messageChannel: false,
      minMessageLength: 4,
      cooldown: 60,
      xpPerMessage: '1-6',
      xpPerMinute: 4,
      noXpChannels: ['c10', 'c11', 'c9'],
      leaderboardChannel: 'c6',
      announceLevelUps: true,
      roleRewards: [
        { level: 5,  role: 'r13', on: true },
        { level: 10, role: 'r12', on: true },
        { level: 20, role: 'r8',  on: true },
        { level: 40, role: 'r7',  on: false },
      ],
      levels: [
        { lvl: 50, xp: 22400 }, { lvl: 45, xp: 18100 }, { lvl: 40, xp: 14400 },
        { lvl: 35, xp: 11200 }, { lvl: 30, xp: 8500 },  { lvl: 25, xp: 6200 },
        { lvl: 20, xp: 4300 },  { lvl: 15, xp: 2800 },  { lvl: 10, xp: 1500 },
        { lvl: 5,  xp: 500 },   { lvl: 1,  xp: 0 },
      ],
    },

    /* ---- counting ---- */
    counting: {
      enabled: true,
      channel: 'c6',
      startAt: 1042,
      current: 1308,
      resetOnError: true,
      deleteWrong: true,
      leaderboardEnabled: true,
      leaderboardChannel: 'c6',
      topLimit: 10,
      noDoubleCount: true,
    },

    /* ---- reaction roles ---- */
    reactionroles: {
      enabled: true,
      channel: 'c3',
      verifyRole: 'r3',
      maxRoles: 3,
      exclusiveGroups: true,
      groups: [
        {
          id: 'g1', name: 'Notifications', desc: 'Choose what you want to hear about', on: true,
          options: [
            { id: 'o1', emoji: '\u{1F514}', name: 'Announcements', role: 'r6' },
            { id: 'o2', emoji: '\u{1F4E3}', name: 'Giveaways',     role: 'r7' },
            { id: 'o3', emoji: '\u{1F680}', name: 'Updates',      role: 'r14' },
          ],
        },
        {
          id: 'g2', name: 'Interests', desc: 'What are you into?', on: true,
          options: [
            { id: 'o4', emoji: '\u{1F3AE}', name: 'Gamer',   role: 'r8' },
            { id: 'o5', emoji: '\u{1F3B2}', name: 'Premium', role: 'r6' },
            { id: 'o6', emoji: '\u{1F3C5}', name: 'Sports',  role: 'r14' },
            { id: 'o7', emoji: '\u{1F4BB}', name: 'Tech',    role: 'r12' },
          ],
        },
      ],
    },

    /* ---- custom roles ---- */
    customroles: {
      enabled: true,
      type: 'button',
      channel: 'c3',
      singleSelect: false,
      color: '#2ecc71',
      roles: [
        { id: 'cr1', role: 'r8',  on: true,  label: 'Gamer' },
        { id: 'cr2', role: 'r6',  on: true,  label: 'Premium' },
        { id: 'cr3', role: 'r7',  on: true,  label: 'VIP' },
        { id: 'cr4', role: 'r12', on: true,  label: 'Level 10' },
        { id: 'cr5', role: 'r14', on: false, label: 'Contributor' },
        { id: 'cr6', role: 'r13', on: true,  label: 'Level 5' },
      ],
    },

    /* ---- giveaways ---- */
    giveaways: {
      enabled: true,
      channel: 'c4',
      requireLevel: 0,
      requireRole: '',
      minAccountAge: 0,
      minMembers: 0,
      maxWinners: 1,
      active: [
        { id: 'gw1', prize: 'Apex Legends Cheat — 1 Month', ends: Date.now() + 86400000 * 1.2, entries: 214, winners: 1, requiredRole: 'r6' },
        { id: 'gw2', prize: 'Steam Wallet $20',              ends: Date.now() + 86400000 * 4.5, entries: 88,  winners: 1, requiredRole: '' },
        { id: 'gw3', prize: 'Nitro 3 Month (3x)',            ends: Date.now() + 86400000 * 0.4, entries: 462, winners: 3, requiredRole: '' },
      ],
      history: [
        { id: 'gwh1', prize: 'Apex Cheat — Lifetime', winner: 'Vinitose', date: '2026-09-20', entries: 1204 },
        { id: 'gwh2', prize: 'Steam Wallet $10',    winner: 'Dhruva',   date: '2026-09-12', entries: 310 },
        { id: 'gwh3', prize: 'Nitro 1 Month',       winner: 'Tumsee',   date: '2026-09-05', entries: 528 },
      ],
    },

    /* ---- embed builder ---- */
    embedbuilder: {
      targetChannel: 'c4',
      author: 'VDEX COP',
      title: 'New Update',
      description: 'We are excited to announce our new updates! Please check out the details below.',
      color: '#7c5cff',
      image: '',
      thumbnail: '',
      footer: 'VDEX COP • Updated now',
      fields: [
        { id: 'ebf1', name: 'Security', value: 'Anti-nuke + Automod upgraded', inline: true },
        { id: 'ebf2', name: 'Performance', value: 'Dashboard loads 40% faster', inline: true },
        { id: 'ebf3', name: 'Support', value: 'Use /new-ticket for anything', inline: false },
      ],
    },

    /* ---- sticky messages ---- */
    stickymessages: {
      enabled: true,
      create: true,
      persistOnRestart: true,
      dest: 'c1',
      messages: [
        { id: 'sm1', channel: 'c1', content: 'Hey {user}! Rules are in #rules, and the latest news in #announcements. Enjoy your stay!', on: true,  time: '2026-09-28 12:00' },
        { id: 'sm2', channel: 'c5', content: 'Showcase your latest Apex clips here — best gets pinned by staff.', on: true, time: '2026-09-27 09:30' },
        { id: 'sm3', channel: 'c6', content: 'Keep counting! The 1500 milestone gives a role.', on: false, time: '2026-09-20 18:45' },
      ],
    },

    /* ---- autoresponder ---- */
    autoresponder: {
      enabled: true,
      type: 'keyword',
      matchCase: false,
      useWildcard: true,
      rateLimit: 5,
      dmOnMatch: false,
      triggers: [
        { id: 'at1', phrase: 'discord',        resp: 'Our invite: https://discord.gg/HKTNOW', on: true,  hits: 88 },
        { id: 'at2', phrase: 'ticket',         resp: 'Use the Tickets category to open a support ticket.', on: true, hits: 34 },
        { id: 'at3', phrase: 'price',          resp: 'Check #announcements for the current price list.', on: true,  hits: 61 },
        { id: 'at4', phrase: 'key*',           resp: 'Keys are delivered instantly after payment.', on: true,  hits: 47 },
        { id: 'at5', phrase: 'refund',         resp: 'Refunds are available within 7 days of purchase.', on: true,  hits: 12 },
      ],
    },

    /* ---- join dm ---- */
    joindm: {
      enabled: true,
      delay: 4,
      retry: 2,
      title: 'Welcome to APEX CHEATS!',
      message: 'Hey {user}, welcome!\n\nPlease read the rules: https://discord.gg/HKTNOW/rules\nIf you need help, open a ticket in the Tickets category.',
      includeRules: true,
      rulesChannel: 'c3',
    },

    /* ---- tickets ---- */
    tickets: {
      enabled: true,
      activeChannel: 'c8',
      openTicket: 6,
      totalOptions: 3,
      selectCategory: true,
      supportPing: 'r4',
      transcript: true,
      logChannel: 'c9',
      categories: [
        { id: 'tc1', label: 'General Support', emoji: '\u{1F527}', color: '#3498db', prefix: 'sup',  opens: 412, cat: 'Support' },
        { id: 'tc2', label: 'Purchase',        emoji: '\u{1F4B3}', color: '#2ecc71', prefix: 'buy',  opens: 268, cat: 'Support' },
        { id: 'tc3', label: 'Report',          emoji: '\u{1F6A8}', color: '#e74c3c', prefix: 'rep',  opens: 94,  cat: 'Support' },
      ],
      openList: [
        { id: 'sup-0131', n: 131, user: 'Wilson',   subject: 'Key not working on HWID',   wait: '4m',  staff: 'Scion' },
        { id: 'buy-0044',  n: 44,  user: 'Dhruva',   subject: 'Need invoice for payment',  wait: '11m', staff: '' },
        { id: 'rep-0012',  n: 12,  user: 'Sneha',    subject: 'User spamming in general',  wait: '26m', staff: 'Gerton' },
        { id: 'sup-0130', n: 130, user: 'AmberFlame', subject: 'HWID reset request',       wait: '1h',  staff: 'Reece' },
        { id: 'sup-0129', n: 129, user: 'Vinitose', subject: 'Refund inquiry',            wait: '2h',  staff: '' },
        { id: 'buy-0043',  n: 43,  user: 'Cannon',   subject: 'Bulk pricing for 10 keys',  wait: '3h',  staff: 'Scion' },
      ],
    },

    /* ---- invites ---- */
    invites: {
      enabled: true,
      trackSources: true,
      flagFake: true,
      logChannel: 'c11',
      minAgeDays: 7,
      invites: [
        { code: 'HKTNOW',   uses: 1842, members: 1204, created: '2023-04-12', source: 'Social Media', active: true },
        { code: 'apexfree', uses: 914,  members: 602,  created: '2024-01-08', source: 'YouTube',     active: true },
        { code: 'store1',   uses: 388,  members: 291,  created: '2025-06-21', source: 'Website',     active: true },
        { code: 'old2023',  uses: 1420, members: 980,  created: '2023-04-12', source: 'Social Media', active: false },
      ],
      suspicious: [
        { tag: 'FakeGiveaway#4412', joins: 84, age: '2 days', reason: 'New account, mass join', action: 'Banned' },
        { tag: 'FreeNitroBot#9931', joins: 41, age: '4 days', reason: 'Phishing link in DM',    action: 'Banned' },
      ],
    },

    /* ---- tracking ---- */
    tracking: {
      enabled: true,
      period: '30d',
      totalJoins: 386,
      totalLeaves: 74,
      netGrowth: 312,
      activeNow: 109,
      peakToday: 168,
      daily: [42,51,38,64,72,58,81,66,74,92,88,71,96,84,79,101,94,88,112,96,84,108,92,88,96,104,92,116,98,104],
      hours:   [2,1,1,1,2,5,14,26,38,44,40,36,34,38,42,46,52,58,54,50,44,36,26,16,8,5,3,2],
      sources: [
        { name: 'Social Media', pct: 42, count: 162 },
        { name: 'YouTube',      pct: 28, count: 108 },
        { name: 'Website',      pct: 18, count: 69 },
        { name: 'Direct / Other', pct: 12, count: 47 },
      ],
      retention30: 91,
    },

    /* ---- member backup ---- */
    memberbackup: {
      enabled: true,
      interval: 6,
      unit: 'hours',
      keepBackups: 10,
      includes: { members: true, roles: true, channels: true, settings: true, bans: true },
      lastBackup: '2026-09-29 12:00',
      totalBackedUp: 4268,
      validTokens: 3912,
      expired: 356,
      size: '14.2 MB',
      backups: [
        { id: 'b1', at: '2026-09-29 12:00', members: 4268, roles: 61, channels: 38, size: '14.2 MB', ok: true },
        { id: 'b2', at: '2026-09-29 06:00', members: 4251, roles: 61, channels: 38, size: '14.1 MB', ok: true },
        { id: 'b3', at: '2026-09-29 00:00', members: 4238, roles: 61, channels: 37, size: '14.0 MB', ok: true },
        { id: 'b4', at: '2026-09-28 18:00', members: 4229, roles: 60, channels: 37, size: '13.9 MB', ok: true },
        { id: 'b5', at: '2026-09-28 12:00', members: 4204, roles: 60, channels: 37, size: '13.8 MB', ok: false },
      ],
    },

    /* ---- booster perks ---- */
    boosterperks: {
      enabled: true,
      role: 'r11',
      welcomeDM: true,
      perks: [
        { id: 'bp1', name: 'Exclusive role',      desc: 'The Booster role with colour', enabled: true },
        { id: 'bp2', name: 'Priority support',    desc: 'Jump to front of ticket queue', enabled: true },
        { id: 'bp3', name: 'Priority queue',      desc: 'Automod and anti-nuke bypass',  enabled: false },
        { id: 'bp4', name: 'Giveaway entry x2',   desc: 'Double entries in all drops',   enabled: true },
        { id: 'bp5', name: 'Custom nickname',     desc: 'Change your nickname freely',   enabled: true },
        { id: 'bp6', name: 'Private text channel',desc: 'Boosters-only chat',            enabled: false },
      ],
    },
  };

  /* ---------------------------------------------------------
     HELPERS
     apply() baad me asli channels/roles `DB.channels/roles` me likhta
     hai — in helpers ko closure ke purane mock list par nahi atakna
     chahiye (warna sab jagah "not set" dikhta tha).
     --------------------------------------------------------- */
  const pickFrom = (id, liveList, mockList) => {
    const key = String(id);
    const hit = (list) => (list || []).find(x => String(x.id) === key) || null;
    return hit(window.DB && window.DB[liveList]) || hit(mockList) || null;
  };
  const chName = (id) => {
    const hit = pickFrom(id, 'channels', channels);
    return (hit && hit.name) || 'not set';
  };
  const roleName = (id) => {
    const hit = pickFrom(id, 'roles', roles);
    return (hit && hit.name) || 'not set';
  };
  const roleColor = (id) => {
    const hit = pickFrom(id, 'roles', roles);
    return (hit && hit.color) || '#99a1b3';
  };
  const modByKey = (k) => modules.find(m => m.key === k) || { key: k, name: k, icon: '?', group: 'Other', desc: '' };

  /* Anti-Nuke — engine in events par nazar rakhta hai (features.py) */
  const antinukeEvents = [
    'Channel Delete', 'Channel Create', 'Channel Update',
    'Role Delete', 'Role Create', 'Permission Grant',
    'Mass Ban', 'Mass Kick', 'Bot Add',
    'Webhook Create', 'Guild Update',
  ];
  const antinukeActions = ['Ban', 'Kick', 'Timeout', 'Warn', 'Ban + Delete Msgs', 'Lockdown', 'Log'];

  return {
    server, modules, groups, channels, categories, roles, members, auditLog,
    config, chName, roleName, roleColor, modByKey, antinukeEvents, antinukeActions,
  };
})();
