// index.js (ESM) — Discord.js v14
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  REST,
  Routes,
  Events,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  Collection,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
} from "discord.js";
import "dotenv/config";
import fs from "fs";
import ms from "ms";

/* =========================
   ثوابت عامة
========================= */
const EMOJI_SUCCESS = "<:succes:1425905723304316988>";
const EMOJI_WRONG = "<:wrong:1425905528202199081>";
const EMOJI_ATTENTION = "<:attention:1425905645781258344>";
const EMOJI_HELLO = "<:hello:1425905607453446155>";
const EMBED_COLOR = 4914944;
const BOT_AVATAR_URL =
  "https://media.discordapp.net/attachments/1419480070724128862/1430977761337675968/succes.png?ex=68fdb7a4&is=68fc6624&hm=e52aad305d1fde46f7d91207fe5c1fd2399f1855725eaccdbf2d463bf01359b3&=&format=webp&quality=lossless&width=873&height=873";
let BOT_ID = null;

const OWNER_ID = process.env.OWNER_ID;
if (!OWNER_ID) console.warn("Missing OWNER_ID in .env");

/* =========================
   إعدادات التقديمات (ثابتة)
========================= */
const LEAVE_COMMAND = "apol";
const MANAGE_PREFIX = "manage";
const MANAGE_COMMAND = "showapplication!!";

const manageQuestions = [
  { title: "اسمك", description: "مساعدة في الاجابة:\n- يجب ان يكون اسمك الحقيقي\n- الاجابات الغير واضحة سيتم رفضها" },
  { title: "عمرك", description: "مساعدة في الاجابة:\n- يجب ان يكون العمر الحقيقي\n- لا يتم قبول من هم تحت ال13 سنة\n- الاجابات الغير واضحة سيتم رفضها" },
  { title: "خبراتك", description: "مساعدة في الاجابة:\n- اي خبرة تمتلكها يمكنك ان تساعدنا فيها, اكتبها\n- الاجابات الغير واضحة سيتم رفضها" },
  { title: "مدى تفاعلك", description: "مساعدة في الاجابة:\n- هل يمكنك التفاعل دائما؟ اكتب عدد الساعات التي يمكنك ان تتفاعل فيها\n- الاجابات الغير واضحة سيتم رفضها" },
  {
    title: "الموافقة",
    description:
      "مساعدة في الاجابة:\n- لن يتم منحك راتباً (امل حقيقي او كريدت)\n- هذا عمل تطوعي\n- لن تقوم باستغغلال رتبتك لافساد السيرفر\n- الاجابات الغير واضحة سيتم رفضها\n- اكتب موافق اذا توافق على ذلك",
  },
];

const NEWS_COMMAND = "!!news!!";
const TICKET_COMMAND = "!!ticketm!!";
const ALLOW_COMMAND = "allow!!";
const DISALLOW_COMMAND = "disallow!!";

/* =========================
   عميل الديسكورد
========================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

/* =========================
   تحميل/حفظ JSON
========================= */
function safeReadJSON(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}
function safeWriteJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

let warnings = safeReadJSON("./warnings.json", {});
let adminWarnings = safeReadJSON("./adminWarnings.json", {});
let leaves = safeReadJSON("./leaves.json", {});
let allowedUsers = safeReadJSON("./allowedUsers.json", {});

// ✅ ترحيل leaves القديم (كان userId -> { guildId, ... }) إلى الجديد (guildId -> userId -> {...})
function migrateLeaves(data) {
  if (!data || typeof data !== "object") return {};
  const keys = Object.keys(data);
  if (keys.length === 0) return {};

  // إذا أول عنصر يحتوي guildId + endDate => غالباً الشكل القديم
  const sample = data[keys[0]];
  const looksOld =
    sample && typeof sample === "object" && "guildId" in sample && "endDate" in sample;

  if (!looksOld) return data; // غالباً بالفعل بالشكل الجديد

  const out = {};
  for (const userId of keys) {
    const entry = data[userId];
    if (!entry || typeof entry !== "object") continue;
    const gId = entry.guildId;
    if (!gId) continue;

    const { guildId, ...rest } = entry;
    out[gId] ??= {};
    out[gId][userId] = rest;
  }
  return out;
}
leaves = migrateLeaves(leaves);

function saveWarnings() {
  safeWriteJSON("./warnings.json", warnings);
}
function saveAdminWarnings() {
  safeWriteJSON("./adminWarnings.json", adminWarnings);
}
function saveLeaves() {
  safeWriteJSON("./leaves.json", leaves);
}
function saveAllowedUsers() {
  safeWriteJSON("./allowedUsers.json", allowedUsers);
}

// حفظ الترحيل مرة واحدة (لو كان الشكل القديم)
saveLeaves();

/* =========================
   إعدادات السيرفرات
========================= */
const settingsFilePath = "./botSettings.json";
let guildSettings = {};

const defaultGuildSettings = {
  autoReplyEnabled: true,
  traditionalCommandsEnabled: true,

  leaveChannelId: null,
  logChannelId: null,
  sendMessageLogChannelId: null,
  dmReplyReviewChannelId: null,
  applicationChannelId: null,
  newsChannelId: null,
  partnershipChannelId: null,
  ticketCategoryId: null,
  reportLogChannelId: null,
  welcomeChannelId: null,
  leaveLogChannelId: null,

  adminRolesToRemove: [],
  punishmentRoleId: null,
  warnRequiredRoleId1: null,
  warnRequiredRoleId2: null,
  acceptRoleId1: null,
  acceptRoleId2: null,
  ticketAdminRoleId: null,

  // رسائل دخول/خروج
  welcomeMessage: "مرحباً بك {user} في سيرفر {server}! أنت العضو رقم {count}.",
  leaveMessage: "غادرنا العضو {user}... أصبح عددنا الآن {count}.",

  // نظام الإجازات: تبديل رتب
  leaveRoleId: null, // رتبة الإجازة
  leaveRolesToRemove: [], // رتب تُسحب أثناء الإجازة (مثلاً رتب الإدارة/الطاقم)
};

function loadBotSettings() {
  guildSettings = safeReadJSON(settingsFilePath, {});
}
function saveBotSettings() {
  safeWriteJSON(settingsFilePath, guildSettings);
}
function getGuildSettings(guildId) {
  if (!guildId) return null;
  if (!guildSettings[guildId]) {
    guildSettings[guildId] = JSON.parse(JSON.stringify(defaultGuildSettings));
    saveBotSettings();
  } else {
    // ضمان وجود مفاتيح جديدة عند التحديث
    guildSettings[guildId] = {
      ...JSON.parse(JSON.stringify(defaultGuildSettings)),
      ...guildSettings[guildId],
    };
  }
  return guildSettings[guildId];
}
loadBotSettings();

process.on("unhandledRejection", (e) =>
  console.error("Unhandled promise rejection:", e)
);

/* =========================
   Anti-spam + فلترة
========================= */
const lastMessages = new Map();
const userMessageCounts = new Map(); // key: guildId:userId
const SPAM_THRESHOLD = 5;
const SPAM_INTERVAL = 7000;
const COOLDOWN_DURATION = 10000;
const spamCooldowns = new Map(); // key: guildId:userId

const offensiveWords = ["حيوان", "كسمك", "ادبسز", "قحبة", "كلب", "عمك"];
const profanityTimeoutDuration = 2 * 60 * 60 * 1000;

function isBotAdmin(member) {
  if (!member) return false;

  if (member.id === OWNER_ID) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const guildAllowed = allowedUsers[member.guild.id];
  if (guildAllowed && guildAllowed[member.id]) return true;

  return false;
}

async function handleProfanity(message) {
  if (message.author.bot || !message.guild || !message.member) return false;
  if (isBotAdmin(message.member)) return false;

  const content = message.content.toLowerCase();
  const isProfane = offensiveWords.some((w) => content.includes(w));

  if (!isProfane) return false;

  try {
    await message.delete().catch(() => {});
    const member = message.member;

    if (member && member.moderatable) {
      await member.timeout(
        profanityTimeoutDuration,
        "استخدام ألفاظ مسيئة (قذف أو سب)"
      );
      await message.author
        .send(
          `⚠️ تم تطبيق Timeout عليك في **${message.guild.name}** لمدة ساعتين بسبب ألفاظ مسيئة.`
        )
        .catch(() => {});
      await message.channel
        .send(`تم معاقبة ${message.author} بالـ **Timeout** لمدة ساعتين.`)
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000));
    } else {
      await message.channel.send(
        `⚠️ لا أملك الصلاحية لتطبيق العقوبة على ${message.author}. تم حذف الرسالة فقط.`
      );
    }
    return true;
  } catch (e) {
    console.error("Profanity filter error:", e);
    return true;
  }
}

/* =========================
   Logs + DM
========================= */
async function sendLogAndDM(
  actionType,
  targetUser,
  executorUser,
  reason,
  guildId,
  duration = null
) {
  const settings = getGuildSettings(guildId);
  if (!settings) return;

  const logChannel = settings.logChannelId
    ? await client.channels.fetch(settings.logChannelId).catch(() => null)
    : null;
  const serverName = client.guilds.cache.get(guildId)?.name || "Server";

  let arabicActionType = actionType;
  let color = 0xff0000;
  if (actionType.includes("Warn")) {
    arabicActionType = "تحذير (Warn)";
    color = 0xffa500;
  } else if (actionType.includes("Auto")) {
    arabicActionType = "تحذير تلقائي (Auto-Mod)";
    color = 0xffa500;
  } else if (actionType.includes("Timeout")) {
    arabicActionType = "Timeout";
    color = 0xffa500;
  } else if (actionType.includes("Kick")) {
    arabicActionType = "طرد (Kick)";
  } else if (actionType.includes("Ban")) {
    arabicActionType = "حظر (Ban)";
  }

  const logEmbed = new EmbedBuilder()
    .setTitle(`🚨 سجل الإشراف - ${arabicActionType}`)
    .setColor(color)
    .addFields(
      { name: "👤 العضو المُستهدف", value: `${targetUser} (\`${targetUser.id}\`)` },
      { name: "🔨 المنفذ", value: `${executorUser} (\`${executorUser.id}\`)` },
      { name: "📝 السبب", value: reason }
    )
    .setTimestamp();

  if (duration) logEmbed.addFields({ name: "⏱️ المدة", value: duration });

  if (logChannel && logChannel.type === ChannelType.GuildText) {
    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
  }

  const dmEmbed = new EmbedBuilder()
    .setTitle(`📢 إجراء إداري: ${actionType}`)
    .setColor(color)
    .setDescription(`تم اتخاذ هذا الإجراء في سيرفر **${serverName}**.`)
    .addFields(
      {
        name: "🔨 Moderator",
        value: `${executorUser.tag ?? executorUser.username ?? executorUser}`,
      },
      { name: "📝 Reason", value: reason }
    )
    .setTimestamp();

  if (duration) dmEmbed.addFields({ name: "⏱️ Duration", value: duration });

  await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
}

async function sendSendMessageLog(executorUser, messageContent, guildId) {
  const settings = getGuildSettings(guildId);
  if (!settings?.sendMessageLogChannelId) return;

  const logChannel = await client.channels
    .fetch(settings.sendMessageLogChannelId)
    .catch(() => null);
  if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

  const logEmbed = new EmbedBuilder()
    .setTitle("✉️ سجل /sendmessage")
    .setColor(0x3498db)
    .addFields(
      { name: "🔨 المنفذ", value: `${executorUser} (\`${executorUser.id}\`)` },
      {
        name: "📝 محتوى الرسالة",
        value: `\`\`\`\n${String(messageContent).substring(0, 1000)}\n\`\`\``,
      }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
}

/* =========================
   التقديمات — Helpers
========================= */
const activeApplications = new Collection(); // DM flows + partnership form

function getApplicationDetails(guildId, type) {
  const settings = getGuildSettings(guildId);
  if (!settings) return null;

  if (type === MANAGE_PREFIX) {
    return {
      questions: manageQuestions,
      title: "تقديم الادارة في السيرفر",
      roleIDs: [settings.acceptRoleId1, settings.acceptRoleId2].filter(Boolean),
      customId: MANAGE_PREFIX,
      reviewChannelId: settings.applicationChannelId,
    };
  }
  return null;
}

function createApplicationPostEmbed(guildId, type) {
  const details = getApplicationDetails(guildId, type);
  if (!details) return null;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("شروط التقديم:")
    .setDescription(
      "- ان لا يكون عمرك اقل من 13 سنة\n- ان لا يكون مدة تواجدك في السيرفر اقل من اسبوع\n- الجواب على جميع الاسئلة بشكل صحيح\n-------------\n**ملاحظة** لا تقم بالتقديم للتجربة فقط او تملأ الاسئلة باجوبة غير مفهومة, والا فسيتم معاقبتك"
    )
    .setAuthor({ name: details.title, iconURL: BOT_AVATAR_URL })
    .setFooter({ text: "للتقديم اضغط الزر ادناه", iconURL: BOT_AVATAR_URL });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${details.customId}_apply_start_button`)
      .setLabel("تقديم ✅")
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

function createDMWelcomeEmbed(guildId, type) {
  const details = getApplicationDetails(guildId, type);
  if (!details) return null;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("هل انت مستعد للبدء في التقديم؟")
    .setDescription(
      "شروط التقديم:\n- ان لا يكون عمرك اقل من 13 سنة\n- ان لا يكون مدة تواجدك في السيرفر اقل من اسبوع\n- الجواب على جميع الاسئلة بشكل صحيح\n-------------\n**ملاحظة** لا تقم بالتقديم للتجربة فقط او تملأ الاسئلة باجوبة غير مفهومة, والا فسيتم معاقبتك\n-------------\nبعد ان تجيب على كل الاسئلة لا تقم بالغاء خاصية ال DM من اجل ان يستطيع البوت ان يرسل اليك النتيجة"
    )
    .setAuthor({ name: details.title, iconURL: BOT_AVATAR_URL })
    .setFooter({
      text: "ابدء في التقديم بالضغط على الزر ادناه",
      iconURL: BOT_AVATAR_URL,
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${details.customId}_start_questions_button`)
      .setLabel("ابدء بالاسئلة")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function createQuestionEmbed(guildId, type, questionIndex) {
  const details = getApplicationDetails(guildId, type);
  if (!details) return null;

  const q = details.questions[questionIndex];
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(q.title)
    .setDescription(q.description)
    .setAuthor({
      name: `السؤال ${questionIndex + 1}`,
      iconURL: BOT_AVATAR_URL,
    })
    .setFooter({ text: "اجب برسالة", iconURL: BOT_AVATAR_URL });

  return { embeds: [embed] };
}

function createSubmissionMessageEmbed(guildId, type) {
  const details = getApplicationDetails(guildId, type);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("تم الارسال بنجاح ✅")
        .setDescription(
          `تم إرسال تقديمك لرتبة **${details.title}**. تتم مراجعة الاجابات، سيتم اعلامك.`
        ),
    ],
  };
}

function createReviewEmbed(guildId, member, type, answers) {
  const details = getApplicationDetails(guildId, type);
  if (!details) return null;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`تقديم ${details.title} جديد من ${member.user.tag}`)
    .setAuthor({ name: member.id, iconURL: member.user.displayAvatarURL() })
    .setFooter({ text: `Application ID: ${member.id} | Type: ${type}` })
    .setTimestamp();

  details.questions.forEach((q, i) =>
    embed.addFields({
      name: `${i + 1}. ${q.title}`,
      value: answers[i] || "لا يوجد إجابة",
    })
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_${type}_accept_${member.id}`)
      .setLabel("قبول ✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`app_${type}_deny_${member.id}`)
      .setLabel("رفض ❌")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`app_${type}_dm_${member.id}`)
      .setLabel("إرسال رسالة خاصة ✉️")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content: `**تطبيق جديد للمراجعة من ${member} (النوع: ${details.title})**`,
    embeds: [embed],
    components: [row],
  };
}

/* =========================
   Panels: Ticket + Leave
========================= */
function createTicketPanelMessage() {
  const ticketEmbed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("طلب المساعدة | دعم فني | ابلاغ")
    .setDescription("اي شيئ تحتاجه وتريد ان تتواصل مع الادارة, افتح تذكرة وسنتواصل معك")
    .setAuthor({
      name: "تذكرة | Ticket",
      iconURL:
        "https://media.discordapp.net/attachments/1422994004538163281/1424045720209461372/4004117b6d61a74d.png?ex=68e2856d&is=68e133ed&hm=451f5a8d0e1de2c9954dc63c7f45ee1a03f81794f8ebe70d7a3dd49ac5746f43&=&format=webp&quality=lossless&width=873&height=873",
    })
    .setFooter({ text: "في حال لم يعمل معك, بلغ عن ذلك", iconURL: BOT_AVATAR_URL });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create_support")
      .setLabel("دعم فني")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🛠️"),
    new ButtonBuilder()
      .setCustomId("ticket_create_report")
      .setLabel("ابلاغ")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚨"),
    new ButtonBuilder()
      .setCustomId("ticket_create_help")
      .setLabel("طلب مساعدة")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🙋‍♂️"),
    new ButtonBuilder()
      .setCustomId("ticket_create_partnership")
      .setLabel("طلب شراكة")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🤝")
  );

  return { embeds: [ticketEmbed], components: [row] };
}

function createLeavePanelMessage() {
  const leaveEmbed = new EmbedBuilder()
    .setTitle("طلب إجازة مؤقتة")
    .setDescription("لتقديم طلب إجازة، يرجى الضغط على الزر أدناه وملء النموذج.")
    .setColor(EMBED_COLOR);

  const leaveButton = new ButtonBuilder()
    .setCustomId("start_leave_request_button")
    .setLabel("تقديم طلب إجازة 📝")
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [leaveEmbed],
    components: [new ActionRowBuilder().addComponents(leaveButton)],
  };
}

/* =========================
   /panel state
========================= */
const panelState = new Map(); // key: guildId:userId -> { panelType, channelId }

/* =========================
   READY
========================= */
client.on(Events.ClientReady, async () => {
  BOT_ID = client.user.id;
  console.log(`✅ Logged in as ${client.user.tag}`);

  // فحص انتهاء الإجازات كل دقيقة (شكل جديد: leaves[guildId][userId])
  setInterval(async () => {
    const now = Date.now();
    const expired = [];

    for (const guildId in leaves) {
      const guildLeaves = leaves[guildId];
      if (!guildLeaves || typeof guildLeaves !== "object") continue;

      for (const userId in guildLeaves) {
        const entry = guildLeaves[userId];
        if (entry?.endDate && entry.endDate <= now) expired.push({ userId, guildId });
      }
    }

    for (const { userId, guildId } of expired) {
      const settings = getGuildSettings(guildId);
      const guild = client.guilds.cache.get(guildId);

      if (!settings || !guild) {
        if (leaves[guildId]) {
          delete leaves[guildId][userId];
          if (Object.keys(leaves[guildId]).length === 0) delete leaves[guildId];
        }
        continue;
      }

      // استرجاع رتب قبل الإجازة (إن وجدت)
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          if (settings.leaveRoleId && member.roles.cache.has(settings.leaveRoleId)) {
            await member.roles.remove(settings.leaveRoleId).catch(() => {});
          }
          const restore = Array.isArray(leaves[guildId]?.[userId]?.removedRoleIds)
            ? leaves[guildId][userId].removedRoleIds
            : [];
          if (restore.length) await member.roles.add(restore).catch(() => {});
        }
      } catch {}

      // لوق اختياري
      if (settings.leaveChannelId) {
        const leaveChannel = await client.channels.fetch(settings.leaveChannelId).catch(() => null);
        if (leaveChannel?.type === ChannelType.GuildText) {
          const embed = new EmbedBuilder()
            .setTitle("✅ انتهاء إجازة تلقائي")
            .setDescription(`انتهت مدة إجازة العضو <@${userId}>.`)
            .setColor(0x57f287)
            .setTimestamp();
          await leaveChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }

      if (leaves[guildId]) {
        delete leaves[guildId][userId];
        if (Object.keys(leaves[guildId]).length === 0) delete leaves[guildId];
      }
    }

    if (expired.length) saveLeaves();
  }, 60000);

  // تسجيل أوامر Slash
  const commands = [
    { name: "help", description: "عرض رسالة المساعدة وجميع الأوامر." },
    {
      name: "panel",
      description: "إرسال بانل جاهز إلى روم تختاره (بدون أوامر نصية).",
      default_member_permissions:
        PermissionFlagsBits.Administrator.toString(),
    },
    {
      name: "sendmessage",
      description: "إرسال رسالة باسم البوت (للإدارة فقط).",
      options: [
        {
          name: "message",
          type: 3,
          description: "الرسالة المراد إرسالها",
          required: true,
        },
      ],
      default_member_permissions:
        PermissionFlagsBits.Administrator.toString(),
    },
    {
      name: "newtimechan",
      description: "إنشاء قناة نصية مؤقتة تُحذف بعد وقت معين.",
      options: [
        { name: "name", type: 3, description: "اسم القناة المؤقتة", required: true },
        { name: "time", type: 3, description: "المدة (e.g., 5m, 1h, 30s) - أقصى مدة 7 أيام", required: true },
        { name: "category", type: 7, channel_types: [ChannelType.GuildCategory], description: "الفئة (اختياري)", required: false },
      ],
    },
    { name: "disablereply", description: "إيقاف الردود التلقائية.", default_member_permissions: PermissionFlagsBits.Administrator.toString() },
    { name: "enablereply", description: "تشغيل الردود التلقائية.", default_member_permissions: PermissionFlagsBits.Administrator.toString() },
    { name: "disablecommands", description: "إيقاف الأوامر التقليدية.", default_member_permissions: PermissionFlagsBits.Administrator.toString() },
    { name: "enablecommands", description: "تشغيل الأوامر التقليدية.", default_member_permissions: PermissionFlagsBits.Administrator.toString() },
    { name: "botstatus", description: "عرض حالة إعدادات البوت.", default_member_permissions: PermissionFlagsBits.Administrator.toString() },

    // /config
    {
      name: "config",
      description: "إعدادات البوت الخاصة بهذا السيرفر.",
      default_member_permissions:
        PermissionFlagsBits.Administrator.toString(),
      options: [
        {
          name: "channel",
          description: "تحديد قناة لخاصية معينة.",
          type: 1,
          options: [
            {
              name: "type",
              description: "اختر الخاصية لتحديد قناتها.",
              type: 3,
              required: true,
              choices: [
                { name: "قناة السجلات (Logs)", value: "logChannelId" },
                { name: "قناة طلبات الإجازة", value: "leaveChannelId" },
                { name: "قناة مراجعة التقديمات", value: "applicationChannelId" },
                { name: "قناة الأخبار", value: "newsChannelId" },
                { name: "قناة الشراكات", value: "partnershipChannelId" },
                { name: "فئة (Category) التذاكر", value: "ticketCategoryId" },
                { name: "قناة مراجعة ردود الخاص", value: "dmReplyReviewChannelId" },
                { name: "قناة سجل /sendmessage", value: "sendMessageLogChannelId" },
                { name: "قناة استقبال البلاغات", value: "reportLogChannelId" },
                { name: "قناة الترحيب", value: "welcomeChannelId" },
                { name: "قناة المغادرة", value: "leaveLogChannelId" },
              ],
            },
            { name: "channel", description: "القناة", type: 7, required: true },
          ],
        },
        {
          name: "role",
          description: "تحديد رتبة لخاصية معينة.",
          type: 1,
          options: [
            {
              name: "type",
              description: "اختر الخاصية لتحديد رتبتها.",
              type: 3,
              required: true,
              choices: [
                { name: "رتبة العقوبة", value: "punishmentRoleId" },
                { name: "رتبة التحذير (1)", value: "warnRequiredRoleId1" },
                { name: "رتبة التحذير (2)", value: "warnRequiredRoleId2" },
                { name: "رتبة إداري التذاكر", value: "ticketAdminRoleId" },
                { name: "رتبة قبول التقديم (1)", value: "acceptRoleId1" },
                { name: "رتبة قبول التقديم (2)", value: "acceptRoleId2" },
                { name: "رتبة الإجازة", value: "leaveRoleId" },
              ],
            },
            { name: "role", description: "الرتبة", type: 8, required: true },
          ],
        },
        {
          name: "role-list",
          description: "تحديد قائمة رتب.",
          type: 1,
          options: [
            {
              name: "type",
              description: "اختر الخاصية.",
              type: 3,
              required: true,
              choices: [
                { name: "رتب الإدارة (تُزال عند العقوبة)", value: "adminRolesToRemove" },
                { name: "رتب تُسحب أثناء الإجازة", value: "leaveRolesToRemove" },
              ],
            },
            { name: "role1", description: "Role 1", type: 8, required: true },
            { name: "role2", description: "Role 2", type: 8, required: false },
            { name: "role3", description: "Role 3", type: 8, required: false },
            { name: "role4", description: "Role 4", type: 8, required: false },
            { name: "role5", description: "Role 5", type: 8, required: false },
            { name: "role6", description: "Role 6", type: 8, required: false },
            { name: "role7", description: "Role 7", type: 8, required: false },
            { name: "role8", description: "Role 8", type: 8, required: false },
          ],
        },
        {
          name: "message",
          description: "تخصيص رسائل الترحيب والمغادرة.",
          type: 1,
          options: [
            {
              name: "type",
              description: "اختر نوع الرسالة.",
              type: 3,
              required: true,
              choices: [
                { name: "رسالة الترحيب (Welcome)", value: "welcomeMessage" },
                { name: "رسالة المغادرة (Leave)", value: "leaveMessage" },
              ],
            },
            { name: "content", description: "استخدم {user} {server} {count}.", type: 3, required: true },
          ],
        },
      ],
    },

    // report
    {
      name: "report",
      description: "الإبلاغ عن عضو لإدارة السيرفر.",
      options: [
        { name: "user", type: 6, description: "العضو", required: true },
        { name: "reason", type: 3, description: "سبب الإبلاغ", required: true },
        { name: "attachment", type: 11, description: "صورة (اختياري)", required: false },
      ],
    },
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  try {
    console.log("Refreshing application (/) commands...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("Slash commands registered.");
    client.user.setActivity("/help للمساعدة");
  } catch (e) {
    console.error(e);
  }
});

/* =========================
   Welcome/Leave messages
========================= */
client.on(Events.GuildMemberAdd, async (member) => {
  const settings = getGuildSettings(member.guild.id);
  if (!settings?.welcomeMessage || !settings?.welcomeChannelId) return;

  const ch = client.channels.cache.get(settings.welcomeChannelId);
  if (!ch) return;

  const msg = settings.welcomeMessage
    .replace(/{user}/g, member.toString())
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, String(member.guild.memberCount));

  await ch.send(msg).catch(() => {});
});

client.on(Events.GuildMemberRemove, async (member) => {
  const settings = getGuildSettings(member.guild.id);
  if (!settings?.leaveMessage || !settings?.leaveLogChannelId) return;

  const ch = client.channels.cache.get(settings.leaveLogChannelId);
  if (!ch) return;

  const msg = settings.leaveMessage
    .replace(/{user}/g, `**${member.user.tag}**`)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, String(member.guild.memberCount));

  await ch.send(msg).catch(() => {});
});

/* =========================
   messageCreate
========================= */
client.on("messageCreate", async (message) => {
  // فلترة ألفاظ
  const handled = await handleProfanity(message);
  if (handled) return;

  // DM flows (تقديمات + نموذج الشراكة)
  if (message.channel.type === ChannelType.DM) {
    if (message.author.bot) return;

    const app = activeApplications.get(message.author.id);
    if (!app) return;

    // نموذج الشراكة (يرسل للتذكرة)
    if (app.type === "partnership_form" && app.step === 1) {
      const ticketChannel = client.channels.cache.get(app.ticketChannelId);
      if (ticketChannel) {
        const embed = new EmbedBuilder()
          .setTitle("📝 نموذج شراكة مُرسل")
          .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
          .setDescription(message.content)
          .setColor(0x57f287)
          .setTimestamp();

        await ticketChannel
          .send({ content: `**تم استلام نموذج شراكة من ${message.author}:**`, embeds: [embed] })
          .catch(() => {});
        await message.channel
          .send("✅ تم إرسال رسالة الشراكة الخاصة بك بنجاح إلى التذكرة.")
          .catch(() => {});
      } else {
        await message.channel
          .send("❌ لم يتم العثور على قناة التذكرة. ربما تم إغلاقها.")
          .catch(() => {});
      }
      activeApplications.delete(message.author.id);
      return;
    }

    // أسئلة التقديم
    const details = getApplicationDetails(app.guildId, app.type);
    if (!details) return;

    if (app.step > 0 && app.step <= details.questions.length) {
      app.answers.push(message.content);

      const nextIndex = app.step; // 0-based
      if (nextIndex < details.questions.length) {
        app.step++;
        await message.channel
          .send(createQuestionEmbed(app.guildId, app.type, nextIndex))
          .catch(() => {});
      } else {
        const guild = client.guilds.cache.get(app.guildId);
        if (!guild) {
          activeApplications.delete(message.author.id);
          return message.channel
            .send("حدث خطأ: لم يتم العثور على السيرفر.")
            .catch(() => {});
        }

        const member = await guild.members.fetch(message.author.id).catch(() => null);
        if (!member) {
          activeApplications.delete(message.author.id);
          return message.channel
            .send("لقد غادرت السيرفر. لا يمكن إكمال التقديم.")
            .catch(() => {});
        }

        if (!details.reviewChannelId) {
          activeApplications.delete(message.author.id);
          return message.channel
            .send("حدث خطأ إداري: لم يتم تحديد قناة مراجعة التقديم.")
            .catch(() => {});
        }

        const reviewCh = client.channels.cache.get(details.reviewChannelId);
        if (reviewCh)
          reviewCh
            .send(createReviewEmbed(app.guildId, member, app.type, app.answers))
            .catch(() => {});
        await message.channel
          .send(createSubmissionMessageEmbed(app.guildId, app.type))
          .catch(() => {});
        activeApplications.delete(message.author.id);
      }
    }
    return;
  }

  // Guild messages
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const settings = getGuildSettings(guildId);

  const member = message.member;
  const userId = message.author.id;
  const executor = message.author;
  const content = message.content;
  const lowerContent = content.toLowerCase();
  const args = content.trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  const target = message.mentions.members.first();
  const now = Date.now();

  // رد تلقائي عند منشن المالك (اختياري)
  if (message.mentions.has(OWNER_ID) && message.author.id !== OWNER_ID && settings.autoReplyEnabled) {
    if (!message.reference) await message.reply("اهلا! يرجى انتظار عمر الى ان يرد عليك!").catch(() => {});
  }

  // Anti-raid: تكرار نفس الرسالة بسرعة
  if (!isBotAdmin(member)) {
    const keyLM = `${guildId}-${userId}`;
    const lastInfo = lastMessages.get(keyLM);
    if (lastInfo && lastInfo.content === content && now - lastInfo.timestamp < 3000) {
      await message.delete().catch(() => {});
      return;
    }
    lastMessages.set(keyLM, { content, timestamp: now });

    // فلتر كلمات/روابط
    const badWordsRegex = new RegExp(
      "\\b(f+u+c*k+|s+h+i+t+|b+i+t+c*h+|a+s+s+h*o*l*e*|d+i+c*k+|c+u+n+t+|ك+س+|ق+ح+ب+ة+|ح+ي+و+ا+ن+|ك+ل+ب+)\\b",
      "gi"
    );
    const linkRegex = /(https?:\/\/\S+|www\.\S+|discord\.gg\/\S+)/gi;

    const canBypassLinkFilter =
      member.permissions.has(PermissionFlagsBits.ManageMessages) ||
      member.permissions.has(PermissionFlagsBits.EmbedLinks);
    let violation = null;

    if (badWordsRegex.test(lowerContent)) violation = `استخدام كلمات غير لائقة ${EMOJI_ATTENTION}`;
    else if (!canBypassLinkFilter && linkRegex.test(lowerContent)) violation = `نشر روابط ممنوعة ${EMOJI_ATTENTION}`;

    if (violation) {
      await message.delete().catch(() => {});
      if (!warnings[guildId]) warnings[guildId] = {};
      if (!warnings[guildId][userId]) warnings[guildId][userId] = { count: 0, reasons: [] };

      warnings[guildId][userId].count++;
      warnings[guildId][userId].reasons.push(violation);
      saveWarnings();

      await sendLogAndDM("Auto Warn", message.author, client.user, `${violation} (التحذيرات: ${warnings[guildId][userId].count})`, guildId);

      return message.channel
        .send(`${EMOJI_ATTENTION} ${member} تم تحذيره. السبب: ${violation}. التحذيرات: ${warnings[guildId][userId].count}`)
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 7000))
        .catch(() => {});
    }

    // Anti-spam (✅ مفصول لكل سيرفر)
    const spamKey = `${guildId}:${userId}`;
    const data = userMessageCounts.get(spamKey) || { count: 0, lastMessageTime: now };
    if (now - data.lastMessageTime > SPAM_INTERVAL) data.count = 1;
    else data.count++;
    data.lastMessageTime = now;
    userMessageCounts.set(spamKey, data);

    if (data.count >= SPAM_THRESHOLD) {
      if (spamCooldowns.has(spamKey) && now < spamCooldowns.get(spamKey)) {
        await message.delete().catch(() => {});
        return;
      }
      spamCooldowns.set(spamKey, now + COOLDOWN_DURATION);
      await message.delete().catch(() => {});

      if (!warnings[guildId]) warnings[guildId] = {};
      if (!warnings[guildId][userId]) warnings[guildId][userId] = { count: 0, reasons: [] };
      warnings[guildId][userId].count++;
      warnings[guildId][userId].reasons.push("تكرار الرسائل (سبام)");
      saveWarnings();

      await sendLogAndDM("Auto Spam Warn", message.author, client.user, `سبام (التحذيرات: ${warnings[guildId][userId].count})`, guildId);

      return message.channel
        .send(`⚠️ ${member} توقف عن التكرار! تم تحذيرك بسبب السبام. التحذيرات: ${warnings[guildId][userId].count}`)
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 7000))
        .catch(() => {});
    }
  }

  // تنظيف ذاكرة السبام
  setTimeout(() => {
    const spamKey = `${guildId}:${userId}`;
    const data = userMessageCounts.get(spamKey);
    if (data && Date.now() - data.lastMessageTime > SPAM_INTERVAL * 2) userMessageCounts.delete(spamKey);
  }, SPAM_INTERVAL * 2 + 1000);

  // ====== أوامر النص القديمة (تظل تعمل) ======
  // نشر لوحة الإجازة بالأمر النصي (اختياري)
  if (lowerContent === LEAVE_COMMAND && settings.leaveChannelId) {
    if (!isBotAdmin(member)) return;
    await message.channel.send(createLeavePanelMessage()).catch(() => {});
    await message.delete().catch(() => {});
    return;
  }

  // نشر لوحة التذاكر بالأمر النصي (اختياري)
  if (lowerContent === TICKET_COMMAND && settings.ticketCategoryId && settings.ticketAdminRoleId) {
    if (!isBotAdmin(member)) return;
    await message.channel.send(createTicketPanelMessage()).catch(() => {});
    await message.delete().catch(() => {});
    return;
  }

  // نشر لوحة التقديمات بالأمر النصي (اختياري)
  if (lowerContent === MANAGE_COMMAND) {
    if (!isBotAdmin(member)) return;
    await message.channel.send(createApplicationPostEmbed(guildId, MANAGE_PREFIX)).catch(() => {});
    await message.delete().catch(() => {});
    return;
  }

  // allow / disallow
  if (command === ALLOW_COMMAND) {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply(`${EMOJI_WRONG} تحتاج Administrator.`);
    const toAllow = message.mentions.members.first();
    if (!toAllow) return message.reply(`${EMOJI_ATTENTION} منشن العضو.`);
    allowedUsers[guildId] ??= {};
    allowedUsers[guildId][toAllow.id] = true;
    saveAllowedUsers();
    return message.reply(`${EMOJI_SUCCESS} تم السماح لـ ${toAllow.user.tag}.`);
  }

  if (command === DISALLOW_COMMAND) {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply(`${EMOJI_WRONG} تحتاج Administrator.`);
    const toDis = message.mentions.members.first();
    if (!toDis) return message.reply(`${EMOJI_ATTENTION} منشن العضو.`);
    if (!allowedUsers[guildId]?.[toDis.id]) return message.reply(`${EMOJI_WRONG} غير موجود في قائمة السماح.`);
    delete allowedUsers[guildId][toDis.id];
    saveAllowedUsers();
    return message.reply(`${EMOJI_SUCCESS} تم إزالة ${toDis.user.tag} من قائمة السماح.`);
  }

  // ====== أمر الأخبار ======
  if (lowerContent.startsWith(NEWS_COMMAND)) {
    if (!isBotAdmin(member)) return;
    if (!settings.newsChannelId) return message.reply("لم يتم تحديد قناة الأخبار. استخدم /config channel.");
    const newsText = content.substring(NEWS_COMMAND.length).trim();
    if (!newsText) return message.reply(`اكتب نص الخبر بعد ${NEWS_COMMAND}`);
    const ch = message.guild.channels.cache.get(settings.newsChannelId);
    if (!ch) return message.reply("قناة الأخبار غير موجودة.");

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("خبر من ادارة السيرفر:")
      .setDescription(newsText)
      .setAuthor({ name: "خبر من الادارة", iconURL: BOT_AVATAR_URL })
      .setFooter({ text: `ناشر الخبر ${message.author.username}`, iconURL: BOT_AVATAR_URL })
      .setTimestamp();

    await ch.send({ content: "@everyone", embeds: [embed] }).catch(() => {});
    await message.delete().catch(() => {});
    return;
  }

  /* =========================
     التحذير العادي:
     إذا تجاوز 5 تحذيرات => Kick
========================= */
  if (command === "warn" || command === "تحذير") {
    if (!target) return message.reply("يرجى منشن العضو أولاً.");
    if (target.id === OWNER_ID) return message.reply("لا يمكن تحذير مالك البوت.");

    const hasRequiredRole =
      (settings.warnRequiredRoleId1 && member.roles.cache.has(settings.warnRequiredRoleId1)) ||
      (settings.warnRequiredRoleId2 && member.roles.cache.has(settings.warnRequiredRoleId2));
    const hasPermission = isBotAdmin(member) || member.permissions.has(PermissionFlagsBits.ManageRoles);
    if (!hasRequiredRole && !hasPermission) return message.reply(`${EMOJI_WRONG} ليس لديك الصلاحيات المطلوبة.`);

    const reason = args.join(" ") || "بلا سبب";

    warnings[guildId] ??= {};
    warnings[guildId][target.id] ??= { count: 0, reasons: [] };
    warnings[guildId][target.id].count++;
    warnings[guildId][target.id].reasons.push(reason);
    saveWarnings();

    const count = warnings[guildId][target.id].count;
    await sendLogAndDM("Warn", target.user, executor, `${reason} (التحذيرات: ${count})`, guildId);

    if (count > 5) {
      try {
        if (!target.kickable) {
          return message.reply(`${EMOJI_WRONG} وصل لأكثر من 5 تحذيرات لكن لا أستطيع طرده (Kick).`);
        }
        await target.kick(`Exceeded 5 warnings. Last reason: ${reason}`);
        delete warnings[guildId][target.id];
        saveWarnings();
        await sendLogAndDM("Kick", target.user, executor, `تم الطرد لتجاوز 5 تحذيرات. السبب الأخير: ${reason}`, guildId);
        return message.reply(`${EMOJI_ATTENTION} تم طرد ${target.user.tag} لتجاوز 5 تحذيرات.`);
      } catch (e) {
        console.error("Kick after warnings failed:", e);
        return message.reply(`${EMOJI_WRONG} فشل طرد العضو بعد تجاوز التحذيرات.`);
      }
    }

    return message.reply(`${EMOJI_SUCCESS} تم تحذير ${target}. التحذيرات الآن: ${count}`);
  }

  if (command === "warnclear" || command === "مسح-التحذيرات") {
    if (!target) return message.reply("يرجى منشن العضو أولاً.");

    const hasRequiredRole =
      (settings.warnRequiredRoleId1 && member.roles.cache.has(settings.warnRequiredRoleId1)) ||
      (settings.warnRequiredRoleId2 && member.roles.cache.has(settings.warnRequiredRoleId2));
    const hasPermission = isBotAdmin(member) || member.permissions.has(PermissionFlagsBits.ManageRoles);
    if (!hasRequiredRole && !hasPermission) return message.reply(`${EMOJI_WRONG} ليس لديك الصلاحيات المطلوبة.`);

    if (!warnings[guildId]?.[target.id]) return message.reply("هذا العضو لا يملك تحذيرات.");
    delete warnings[guildId][target.id];
    saveWarnings();
    await sendLogAndDM("Warn Clear", target.user, executor, "تم مسح التحذيرات يدوياً.", guildId);
    return message.reply(`${EMOJI_SUCCESS} تم مسح تحذيرات ${target.user.tag}.`);
  }

  // الأوامر التقليدية (ban/kick/timeout...) — إذا كانت مفعلة
  if (content.startsWith("/") || !settings.traditionalCommandsEnabled) return;

  const hasModPermission = isBotAdmin(member) || member.permissions.has(PermissionFlagsBits.BanMembers);
  if (!hasModPermission) return;

  try {
    switch (command) {
      case "ban":
      case "باند": {
        if (!target) return message.reply("يرجى منشن العضو أولاً.");
        if (!target.bannable) return message.reply("لا يمكنني حظر هذا العضو.");
        const reason = args.join(" ") || "بلا سبب";
        await target.ban({ reason });
        await sendLogAndDM("Ban", target.user, executor, reason, guildId);
        return message.reply(`${EMOJI_SUCCESS} تم حظر ${target.user.tag}.`);
      }

      case "kick":
      case "طرد": {
        if (!target) return message.reply("يرجى منشن العضو أولاً.");
        if (!target.kickable) return message.reply("لا يمكنني طرد هذا العضو.");
        const reason = args.join(" ") || "بلا سبب";
        await target.kick(reason);
        await sendLogAndDM("Kick", target.user, executor, reason, guildId);
        return message.reply(`${EMOJI_SUCCESS} تم طرد ${target.user.tag}.`);
      }

      case "timeout":
      case "تايم": {
        if (!target) return message.reply("يرجى منشن العضو أولاً.");
        if (!target.moderatable) return message.reply("لا يمكنني تايم لهذا العضو.");
        const durationMs = ms(args[0]);
        if (!durationMs) return message.reply("حدد وقت صحيح مثل: 1d، 2h، 30m");
        const reason = args.slice(1).join(" ") || "بلا سبب";
        await target.timeout(durationMs, reason);
        await sendLogAndDM("Timeout", target.user, executor, reason, guildId, ms(durationMs, { long: true }));
        return message.reply(`${EMOJI_SUCCESS} تم اسكاته لمدة ${ms(durationMs, { long: true })}.`);
      }

      case "untimeout":
      case "فك": {
        if (!target) return message.reply("يرجى منشن العضو أولاً.");
        await target.timeout(null);
        await sendLogAndDM("Untimeout", target.user, executor, "Timeout removed manually", guildId);
        return message.reply(`${EMOJI_SUCCESS} تم فك التايم.`);
      }

      case "unban":
      case "فك-الحظر": {
        const id = args[0];
        if (!id) return message.reply("ضع ID العضو.");
        const user = await client.users.fetch(id).catch(() => null);
        if (!user) return message.reply("ID غير صحيح.");
        await message.guild.bans.remove(user, `Unbanned by ${executor.tag}`);
        await sendLogAndDM("Unban", user, executor, "فك حظر يدوي.", guildId);
        return message.reply(`${EMOJI_SUCCESS} تم فك حظر ${user.tag}.`);
      }
    }
  } catch (e) {
    console.error(e);
    return message.reply(`${EMOJI_WRONG} Something went wrong.`);
  }
});

/* =========================
   guildCreate (ترحيب)
========================= */
client.on("guildCreate", async (guild) => {
  getGuildSettings(guild.id);

  let defaultChannel = null;
  if (
    guild.systemChannel &&
    guild.systemChannel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
  ) {
    defaultChannel = guild.systemChannel;
  } else {
    defaultChannel = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildText &&
        c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
    );
  }
  if (!defaultChannel) return;

  const embed = new EmbedBuilder()
    .setTitle(`${EMOJI_HELLO} شكراً لإضافتي إلى سيرفركم!`)
    .setDescription("أنا جاهز للمساعدة في إدارة السيرفر وحمايته.")
    .addFields(
      { name: "الخطوة التالية", value: "استخدم `/config` لتعيين القنوات والرتب المطلوبة." },
      { name: "للمساعدة", value: "اكتب `/help` لرؤية الأوامر." }
    )
    .setColor(0x00ff00);

  await defaultChannel.send({ embeds: [embed] }).catch(() => {});
});

/* =========================
   InteractionCreate
========================= */
client.on(Events.InteractionCreate, async (interaction) => {
  // ===== DM interactions =====
  if (!interaction.guild) {
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId.endsWith("_start_questions_button")) {
        const type = customId.startsWith(MANAGE_PREFIX) ? MANAGE_PREFIX : null;
        if (!type) return;

        const app = activeApplications.get(interaction.user.id);
        if (!app || app.type !== type || app.step !== 0) {
          return interaction.reply({ content: "حدث خطأ. ابدأ التقديم من السيرفر.", ephemeral: true });
        }

        app.step = 1;
        return interaction.reply(createQuestionEmbed(app.guildId, type, 0));
      }
    }
    return;
  }

  // ===== Guild interactions =====
  const guildId = interaction.guild.id;
  const settings = getGuildSettings(guildId);
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

  // ---------- Slash Commands ----------
  if (interaction.isCommand()) {
    if (interaction.commandName === "help") {
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJI_HELLO} أهلاً بك!`)
        .setDescription("أنا بوت للمساعدة في الإدارة والحماية والتذاكر والتقديمات.")
        .setColor(0x00ff00);

      const embed2 = new EmbedBuilder()
        .setTitle("أوامر مهمة")
        .setColor(0x3498db)
        .addFields(
          { name: "/panel", value: "إرسال بانل التذاكر/التقديم/الإجازة لأي روم تختاره." },
          { name: "/config", value: "إعداد القنوات/الرتب (ومنها رتبة الإجازة + رتب تُسحب)." },
          { name: "warn", value: "التحذير العادي: إذا تجاوز 5 تحذيرات => Kick." }
        );

      return interaction.reply({ embeds: [embed, embed2] });
    }

    if (interaction.commandName === "panel") {
      if (!isAdmin) return interaction.reply({ content: "يجب أن تكون Administrator.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle("إرسال بانل")
        .setDescription("1) اختر البانل\n2) اختر الروم\n3) اضغط إرسال\n\nملاحظة: يمكن إلغاء اختيار الروم (تم إصلاحها).");

      const panelSelect = new StringSelectMenuBuilder()
        .setCustomId("panel_select_type")
        .setPlaceholder("اختيار البانل")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          { label: "بانل التذاكر", value: "ticket", description: "يرسل لوحة التذاكر" },
          { label: "بانل التقديمات (إدارة)", value: "manage", description: "يرسل لوحة تقديم الإدارة" },
          { label: "بانل الإجازات", value: "leave", description: "يرسل لوحة طلب الإجازة" }
        );

      // minValues = 0 يسمح بإلغاء الاختيار
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId("panel_select_channel")
        .setPlaceholder("اختيار الروم")
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(0)
        .setMaxValues(1);

      const sendBtn = new ButtonBuilder()
        .setCustomId("panel_send_now")
        .setLabel("إرسال")
        .setStyle(ButtonStyle.Success);

      const row1 = new ActionRowBuilder().addComponents(panelSelect);
      const row2 = new ActionRowBuilder().addComponents(channelSelect);
      const row3 = new ActionRowBuilder().addComponents(sendBtn);

      const key = `${guildId}:${interaction.user.id}`;
      panelState.set(key, { panelType: null, channelId: null });

      return interaction.reply({ embeds: [embed], components: [row1, row2, row3], ephemeral: false });
    }

    if (interaction.commandName === "config") {
      if (!isAdmin) return interaction.reply({ content: "Administrator فقط.", ephemeral: true });

      const sub = interaction.options.getSubcommand();
      const type = interaction.options.getString("type");

      if (sub === "channel") {
        const ch = interaction.options.getChannel("channel");

        if (type === "ticketCategoryId" && ch.type !== ChannelType.GuildCategory) {
          return interaction.reply({ content: `${EMOJI_WRONG} فئة التذاكر يجب أن تكون Category.`, ephemeral: true });
        }
        if (type !== "ticketCategoryId" && ch.type !== ChannelType.GuildText) {
          return interaction.reply({ content: `${EMOJI_WRONG} هذا الإعداد يحتاج Text Channel.`, ephemeral: true });
        }

        settings[type] = ch.id;
        saveBotSettings();
        return interaction.reply({ content: `${EMOJI_SUCCESS} تم تحديث ${type} إلى ${ch}.`, ephemeral: true });
      }

      if (sub === "role") {
        const role = interaction.options.getRole("role");
        settings[type] = role.id;
        saveBotSettings();
        return interaction.reply({ content: `${EMOJI_SUCCESS} تم تحديث ${type} إلى ${role}.`, ephemeral: true });
      }

      if (sub === "role-list") {
        const roles = [];
        for (let i = 1; i <= 8; i++) {
          const r = interaction.options.getRole(`role${i}`);
          if (r) roles.push(r.id);
        }
        if (type === "adminRolesToRemove") settings.adminRolesToRemove = roles;
        if (type === "leaveRolesToRemove") settings.leaveRolesToRemove = roles;
        saveBotSettings();
        return interaction.reply({ content: `${EMOJI_SUCCESS} تم تحديث ${type} بـ ${roles.length} رتب.`, ephemeral: true });
      }

      if (sub === "message") {
        const content = interaction.options.getString("content");
        settings[type] = content;
        saveBotSettings();
        return interaction.reply({ content: `${EMOJI_SUCCESS} تم تحديث الرسالة بنجاح.\n${content}`, ephemeral: true });
      }
    }

    if (interaction.commandName === "sendmessage") {
      if (!isAdmin) return interaction.reply({ content: "Administrator فقط.", ephemeral: true });
      const msg = interaction.options.getString("message");
      await interaction.channel.send(msg).catch(() => {});
      await interaction.reply({ content: "تم إرسال الرسالة.", ephemeral: true });
      await sendSendMessageLog(interaction.user, msg, guildId);
      return;
    }

    if (interaction.commandName === "newtimechan") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: 'You need "Manage Channels".', ephemeral: true });
      }
      const name = interaction.options.getString("name");
      const timeStr = interaction.options.getString("time");
      const category = interaction.options.getChannel("category");
      const duration = ms(timeStr);

      if (!duration || duration < 10000 || duration > ms("7d")) {
        return interaction.reply({ content: "Invalid time. Min 10s, Max 7d.", ephemeral: true });
      }

      try {
        const ch = await interaction.guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: category ? category.id : null,
        });

        await interaction.reply({ content: `${EMOJI_SUCCESS} تم إنشاء ${ch} وسيُحذف بعد ${ms(duration, { long: true })}.` });

        setTimeout(async () => {
          await ch.delete().catch(() => {});
        }, duration);
      } catch (e) {
        console.error(e);
        return interaction.reply({ content: `${EMOJI_WRONG} فشل إنشاء القناة.`, ephemeral: true });
      }
      return;
    }

    if (interaction.commandName === "disablereply") {
      if (!isAdmin) return interaction.reply({ content: "Administrator فقط.", ephemeral: true });
      settings.autoReplyEnabled = false;
      saveBotSettings();
      return interaction.reply({ content: `${EMOJI_SUCCESS} تم إيقاف الردود التلقائية.`, ephemeral: true });
    }
    if (interaction.commandName === "enablereply") {
      if (!isAdmin) return interaction.reply({ content: "Administrator فقط.", ephemeral: true });
      settings.autoReplyEnabled = true;
      saveBotSettings();
      return interaction.reply({ content: `${EMOJI_SUCCESS} تم تشغيل الردود التلقائية.`, ephemeral: true });
    }
    if (interaction.commandName === "disablecommands") {
      if (!isAdmin) return interaction.reply({ content: "Administrator فقط.", ephemeral: true });
      settings.traditionalCommandsEnabled = false;
      saveBotSettings();
      return interaction.reply({ content: `${EMOJI_SUCCESS} تم إيقاف الأوامر التقليدية.`, ephemeral: true });
    }
    if (interaction.commandName === "enablecommands") {
      if (!isAdmin) return interaction.reply({ content: "Administrator فقط.", ephemeral: true });
      settings.traditionalCommandsEnabled = true;
      saveBotSettings();
      return interaction.reply({ content: `${EMOJI_SUCCESS} تم تشغيل الأوامر التقليدية.`, ephemeral: true });
    }
    if (interaction.commandName === "botstatus") {
      if (!isAdmin) return interaction.reply({ content: "Administrator فقط.", ephemeral: true });
      return interaction.reply({
        content: `Bot Status:\n- Auto Replies: ${settings.autoReplyEnabled ? "Enabled" : "Disabled"}\n- Traditional Commands: ${
          settings.traditionalCommandsEnabled ? "Enabled" : "Disabled"
        }`,
        ephemeral: true,
      });
    }

    // report (مختصر)
    if (interaction.commandName === "report") {
      if (!settings.reportLogChannelId) return interaction.reply({ content: "❌ لم يتم إعداد قناة البلاغات.", ephemeral: true });
      const logCh = client.channels.cache.get(settings.reportLogChannelId);
      if (!logCh) return interaction.reply({ content: "❌ قناة البلاغات غير موجودة.", ephemeral: true });

      const targetMember = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason");
      const attachment = interaction.options.getAttachment("attachment");
      const reporter = interaction.user;

      if (!targetMember) return interaction.reply({ content: "❌ لم يتم العثور على العضو.", ephemeral: true });
      if (targetMember.user.id === reporter.id) return interaction.reply({ content: "❌ لا يمكنك الإبلاغ عن نفسك.", ephemeral: true });
      if (targetMember.user.bot) return interaction.reply({ content: "❌ لا يمكنك الإبلاغ عن بوت.", ephemeral: true });

      const reportEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("🚨 بلاغ جديد")
        .setThumbnail(targetMember.user.displayAvatarURL())
        .addFields(
          { name: "المستخدم المُبلَّغ عنه", value: `${targetMember} (${targetMember.user.tag})\nID: ${targetMember.user.id}`, inline: false },
          { name: "السبب", value: reason, inline: false },
          { name: "صاحب البلاغ", value: `${reporter} (${reporter.tag})`, inline: false }
        )
        .setTimestamp();

      if (attachment) reportEmbed.setImage(attachment.url);

      await logCh.send({ embeds: [reportEmbed] }).catch(() => {});
      return interaction.reply({ content: "✅ تم إرسال بلاغك للإدارة.", ephemeral: true });
    }
  }

  // ---------- Select menus for /panel ----------
  if (interaction.isStringSelectMenu() && interaction.customId === "panel_select_type") {
    const key = `${guildId}:${interaction.user.id}`;
    const state = panelState.get(key) || { panelType: null, channelId: null };
    state.panelType = interaction.values[0];
    panelState.set(key, state);
    return interaction.reply({ content: `${EMOJI_SUCCESS} تم اختيار البانل: **${interaction.values[0]}**`, ephemeral: true });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === "panel_select_channel") {
    const key = `${guildId}:${interaction.user.id}`;
    const state = panelState.get(key) || { panelType: null, channelId: null };

    // إذا المستخدم ألغى الاختيار => values فارغة
    state.channelId = interaction.values?.[0] || null;
    panelState.set(key, state);

    if (!state.channelId) {
      return interaction.reply({ content: `${EMOJI_SUCCESS} تم إلغاء اختيار الروم.`, ephemeral: true });
    }
    return interaction.reply({ content: `${EMOJI_SUCCESS} تم اختيار الروم: <#${state.channelId}>`, ephemeral: true });
  }

  // ---------- Send button for /panel ----------
  if (interaction.isButton() && interaction.customId === "panel_send_now") {
    if (!isAdmin) return interaction.reply({ content: "Administrator فقط.", ephemeral: true });

    const key = `${guildId}:${interaction.user.id}`;
    const state = panelState.get(key);

    if (!state?.panelType) return interaction.reply({ content: `${EMOJI_WRONG} اختر البانل أولاً.`, ephemeral: true });
    if (!state?.channelId) return interaction.reply({ content: `${EMOJI_WRONG} اختر الروم أولاً.`, ephemeral: true });

    const targetChannel = interaction.guild.channels.cache.get(state.channelId);
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      return interaction.reply({ content: `${EMOJI_WRONG} الروم غير صالح.`, ephemeral: true });
    }

    // تحقق متطلبات بعض البانلات
    if (state.panelType === "ticket" && (!settings.ticketCategoryId || !settings.ticketAdminRoleId)) {
      return interaction.reply({ content: `${EMOJI_WRONG} نظام التذاكر غير مُعد (/config channel + /config role).`, ephemeral: true });
    }

    // إرسال البانل
    try {
      if (state.panelType === "ticket") await targetChannel.send(createTicketPanelMessage());
      else if (state.panelType === "manage") await targetChannel.send(createApplicationPostEmbed(guildId, MANAGE_PREFIX));
      else if (state.panelType === "leave") await targetChannel.send(createLeavePanelMessage());

      // تعديل رسالة /panel الحالية: تم الإرسال + تعطيل الأزرار
      const doneEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription("✅ تم ارسال الايمبد بنجاح.")
        .setColor(0x57f287);

      const disabled = interaction.message.components.map((row) => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components = newRow.components.map((c) => {
          const comp = c;
          if (comp.data?.disabled !== undefined) comp.setDisabled(true);
          return comp;
        });
        return newRow;
      });

      await interaction.update({ embeds: [doneEmbed], components: disabled });
      panelState.delete(key);
      return;
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: `${EMOJI_WRONG} فشل إرسال البانل.`, ephemeral: true });
    }
  }

  // ---------- Buttons: Leave system ----------
  if (interaction.isButton() && interaction.customId === "start_leave_request_button") {
    const leaveModal = new ModalBuilder().setCustomId("leave_request_modal").setTitle("تقديم طلب إجازة");
    const durationInput = new TextInputBuilder()
      .setCustomId("leave_duration")
      .setLabel("كم مدة الاجازة؟")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("مثال: 1d, 3w, 2h")
      .setRequired(true);

    const reasonInput = new TextInputBuilder()
      .setCustomId("leave_reason")
      .setLabel("ما هو سبب الاجازة؟")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const interactionInput = new TextInputBuilder()
      .setCustomId("leave_interaction")
      .setLabel("هل تستطيع التفاعل أثناء الإجازة؟")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("نعم / لا / بشكل متقطع")
      .setRequired(true);

    leaveModal.addComponents(
      new ActionRowBuilder().addComponents(durationInput),
      new ActionRowBuilder().addComponents(reasonInput),
      new ActionRowBuilder().addComponents(interactionInput)
    );

    return interaction.showModal(leaveModal);
  }

  // ---------- Buttons: Application start ----------
  if (interaction.isButton() && interaction.customId.endsWith("_apply_start_button")) {
    const type = interaction.customId.startsWith(MANAGE_PREFIX) ? MANAGE_PREFIX : null;
    if (!type) return;

    const details = getApplicationDetails(guildId, type);
    if (!details?.reviewChannelId) return interaction.reply({ content: "نظام التقديم غير مُعد.", ephemeral: true });

    const member = interaction.member;
    if (activeApplications.has(member.id)) return interaction.reply({ content: "لديك تقديم نشط بالفعل (في الخاص).", ephemeral: true });

    try {
      await member.send(createDMWelcomeEmbed(guildId, type));
      activeApplications.set(member.id, { type, step: 0, answers: [], guildId });
      return interaction.reply({ content: "✅ تم إرسال رسالة خاصة لبدء التقديم.", ephemeral: true });
    } catch {
      return interaction.reply({ content: "افتح الخاص (DM) حتى أستطيع إرسال التقديم.", ephemeral: true });
    }
  }

  // ---------- Ticket create buttons ----------
  if (interaction.isButton() && interaction.customId.startsWith("ticket_create_")) {
    if (!settings.ticketCategoryId || !settings.ticketAdminRoleId) return interaction.reply({ content: "نظام التذاكر غير مُعد.", ephemeral: true });

    const type = interaction.customId.split("_")[2];
    let title = "تذكرة جديدة";
    if (type === "support") title = "دعم فني";
    if (type === "report") title = "ابلاغ";
    if (type === "help") title = "طلب مساعدة";
    if (type === "partnership") title = "طلب شراكة";

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const member = interaction.member;

    const existing = guild.channels.cache.find((c) => c.parentId === settings.ticketCategoryId && c.topic === member.id);
    if (existing) return interaction.editReply({ content: `لديك تذكرة مفتوحة بالفعل: ${existing}` });

    const ticketChannel = await guild.channels.create({
      name: `ticket-${member.user.username}`,
      type: ChannelType.GuildText,
      parent: settings.ticketCategoryId,
      topic: member.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: settings.ticketAdminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
      ],
    });

    const welcomeEmbed = new EmbedBuilder()
      .setColor(8703)
      .setTitle(title)
      .setDescription(`اهلا بك ${member}\nاشرح مشكلتك بالتفصيل وسنساعدك`)
      .setFooter({ text: "الأزرار أدناه للإدمنز فقط", iconURL: BOT_AVATAR_URL });

    const adminButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_close").setLabel("اغلاق").setStyle(ButtonStyle.Danger).setEmoji("🔒"),
      new ButtonBuilder().setCustomId("ticket_claim").setLabel("استلام").setStyle(ButtonStyle.Success).setEmoji("👋"),
      new ButtonBuilder().setCustomId("ticket_rename").setLabel("إعادة تسمية").setStyle(ButtonStyle.Primary).setEmoji("📝"),
      new ButtonBuilder().setCustomId("ticket_add_member").setLabel("إضافة عضو").setStyle(ButtonStyle.Secondary).setEmoji("👤")
    );

    await ticketChannel.send({ content: `<@&${settings.ticketAdminRoleId}>, ${member} فتح تذكرة جديدة.`, embeds: [welcomeEmbed], components: [adminButtons] });

    if (type === "partnership") {
      const btn = new ButtonBuilder()
        .setCustomId("partnership_form_start")
        .setLabel("ارسال النموذج الخاص بالشراكة")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📝");
      await ticketChannel.send({
        content: `اهلا بك ${member}!\nاضغط الزر لإرسال نموذج الشراكة في الخاص.`,
        components: [new ActionRowBuilder().addComponents(btn)],
      });
    }

    return interaction.editReply({ content: `✅ تم فتح تذكرتك: ${ticketChannel}` });
  }

  // ---------- Ticket admin buttons ----------
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
    if (!settings.ticketAdminRoleId || !interaction.member.roles.cache.has(settings.ticketAdminRoleId)) {
      return interaction.reply({ content: "ليس لديك الصلاحية.", ephemeral: true });
    }

    const channel = interaction.channel;
    const creatorId = channel.topic;

    if (interaction.customId === "ticket_claim") {
      await interaction.deferUpdate();
      const msg = interaction.message;
      const embed = msg.embeds[0];

      if (embed?.description?.includes("قام")) return interaction.followUp({ content: "تم استلامها بالفعل.", ephemeral: true });

      // جعل الاستلام حصرياً
      await channel.permissionOverwrites.edit(settings.ticketAdminRoleId, { SendMessages: false }).catch(() => {});
      await channel.permissionOverwrites.edit(interaction.member.id, { ViewChannel: true, SendMessages: true }).catch(() => {});

      const updated = EmbedBuilder.from(embed).setDescription((embed.description ?? "") + `\n\n**${EMOJI_SUCCESS} قام ${interaction.user} باستلام التذكرة**`);
      await msg.edit({ embeds: [updated] }).catch(() => {});
      return;
    }

    if (interaction.customId === "ticket_close") {
      await interaction.deferUpdate();
      if (creatorId) await channel.permissionOverwrites.edit(creatorId, { ViewChannel: false }).catch(() => {});
      await channel.permissionOverwrites.edit(settings.ticketAdminRoleId, { ViewChannel: true, SendMessages: false }).catch(() => {});

      const closedEmbed = new EmbedBuilder().setColor(0xff0000).setDescription(`🔒 تم إغلاق التذكرة بواسطة ${interaction.user}.`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_open").setLabel("فتح").setStyle(ButtonStyle.Success).setEmoji("🔓"),
        new ButtonBuilder().setCustomId("ticket_delete").setLabel("مسح").setStyle(ButtonStyle.Danger).setEmoji("🗑️")
      );
      await channel.send({ embeds: [closedEmbed], components: [row] }).catch(() => {});
      return;
    }

    if (interaction.customId === "ticket_open") {
      await interaction.deferUpdate();
      if (creatorId) await channel.permissionOverwrites.edit(creatorId, { ViewChannel: true }).catch(() => {});
      await channel.permissionOverwrites.edit(settings.ticketAdminRoleId, { SendMessages: true }).catch(() => {});
      await channel.send({ embeds: [new EmbedBuilder().setColor(0x00ff00).setDescription(`🔓 تم فتح التذكرة بواسطة ${interaction.user}.`)] }).catch(() => {});
      await interaction.message.delete().catch(() => {});
      return;
    }

    if (interaction.customId === "ticket_delete") {
      await interaction.reply({ content: "🗑️ سيتم حذف التذكرة بعد 5 ثوانٍ...", ephemeral: false }).catch(() => {});
      setTimeout(() => channel.delete("Ticket deleted by admin.").catch(() => {}), 5000);
      return;
    }

    if (interaction.customId === "ticket_rename") {
      const modal = new ModalBuilder().setCustomId("ticket_rename_modal").setTitle("إعادة تسمية التذكرة");
      const nameInput = new TextInputBuilder().setCustomId("ticket_new_name").setLabel("الاسم الجديد").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
      return interaction.showModal(modal);
    }

    if (interaction.customId === "ticket_add_member") {
      const modal = new ModalBuilder().setCustomId("ticket_add_member_modal").setTitle("إضافة عضو للتذكرة");
      const idInput = new TextInputBuilder().setCustomId("ticket_member_id").setLabel("ID العضو").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(idInput));
      return interaction.showModal(modal);
    }
  }

  // ---------- Partnership form start ----------
  if (interaction.isButton() && interaction.customId === "partnership_form_start") {
    const userId = interaction.member.id;
    if (activeApplications.has(userId)) return interaction.reply({ content: "لديك عملية نشطة بالفعل.", ephemeral: true });

    try {
      await interaction.member.send("يرجى إرسال رسالة الشراكة الآن. سيتم إرسالها مباشرة للتذكرة.");
      activeApplications.set(userId, { type: "partnership_form", step: 1, guildId, ticketChannelId: interaction.channel.id });
      return interaction.reply({ content: "✅ تم إرسال رسالة خاصة لك لإرسال نموذج الشراكة.", ephemeral: true });
    } catch {
      return interaction.reply({ content: "لا أستطيع إرسال DM. افتح الخاص.", ephemeral: true });
    }
  }

  // ---------- Modals ----------
  if (interaction.isModalSubmit()) {
    // Leave request submit
    if (interaction.customId === "leave_request_modal") {
      const durationStr = interaction.fields.getTextInputValue("leave_duration");
      const reason = interaction.fields.getTextInputValue("leave_reason");
      const canInteract = interaction.fields.getTextInputValue("leave_interaction");
      const durationMs = ms(durationStr);

      if (!durationMs || durationMs <= 0) return interaction.reply({ content: `${EMOJI_WRONG} صيغة المدة غير صحيحة.`, ephemeral: true });

      const endDate = Date.now() + durationMs;
      const endTs = Math.floor(endDate / 1000);

      // تبديل الرتب عند الإجازة
      const member = interaction.member;
      const removedRoleIds = [];
      if (Array.isArray(settings.leaveRolesToRemove) && settings.leaveRolesToRemove.length) {
        for (const rId of settings.leaveRolesToRemove) {
          if (member.roles.cache.has(rId)) removedRoleIds.push(rId);
        }
      }

      try {
        if (removedRoleIds.length) await member.roles.remove(removedRoleIds, "Leave: roles removed").catch(() => {});
        if (settings.leaveRoleId && !member.roles.cache.has(settings.leaveRoleId)) {
          await member.roles.add(settings.leaveRoleId, "Leave: leave role added").catch(() => {});
        }
      } catch (e) {
        console.error("Leave role swap failed:", e);
      }

      // ✅ تخزين الإجازة لكل سيرفر (يمنع تداخل السيرفرات)
      leaves[guildId] ??= {};
      leaves[guildId][member.id] = {
        endDate,
        reason,
        interaction: canInteract,
        removedRoleIds,
      };
      saveLeaves();

      await interaction.reply({ content: `${EMOJI_SUCCESS} تم تسجيل إجازتك. تنتهي: <t:${endTs}:F>.`, ephemeral: true });

      // إرسال لوق لقناة الإجازات إن وجدت
      if (settings.leaveChannelId) {
        const leaveCh = await client.channels.fetch(settings.leaveChannelId).catch(() => null);
        if (leaveCh?.type === ChannelType.GuildText) {
          const embed = new EmbedBuilder()
            .setTitle("📝 تسجيل إجازة جديدة")
            .setColor(0x3498db)
            .setAuthor({ name: member.displayName, iconURL: member.user.displayAvatarURL() })
            .addFields(
              { name: "👤 العضو", value: member.toString(), inline: false },
              { name: "⏳ مدة الإجازة", value: `\`${durationStr}\``, inline: true },
              { name: "📅 تاريخ الانتهاء", value: `<t:${endTs}:R>`, inline: true },
              { name: "❓ السبب", value: reason, inline: false },
              { name: "🤝 إمكانية التفاعل", value: canInteract, inline: false }
            )
            .setTimestamp();

          await leaveCh.send({ embeds: [embed] }).catch(() => {});
        }
      }
      return;
    }

    if (interaction.customId === "ticket_rename_modal") {
      const newName = interaction.fields.getTextInputValue("ticket_new_name");
      await interaction.channel.setName(newName).catch(() => {});
      return interaction.reply({ content: `✅ تم تغيير الاسم إلى \`${newName}\`.`, ephemeral: true });
    }

    if (interaction.customId === "ticket_add_member_modal") {
      const id = interaction.fields.getTextInputValue("ticket_member_id");
      await interaction.deferReply({ ephemeral: true });
      const m = await interaction.guild.members.fetch(id).catch(() => null);
      if (!m) return interaction.editReply({ content: "لم يتم العثور على عضو بهذا الـ ID." });

      await interaction.channel.permissionOverwrites.edit(m.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      }).catch(() => {});
      return interaction.editReply({ content: `✅ تم إضافة ${m} للتذكرة.` });
    }
  }
});

/* =========================
   Login
========================= */
client.login(process.env.BOT_TOKEN);
