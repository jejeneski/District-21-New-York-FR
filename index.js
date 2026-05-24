const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require("discord.js");

const express = require("express");

/* =========================
   DEBUG STARTUP
========================= */

console.log("🚀 Bot starting...");

process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:");
  console.error(err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ UNHANDLED REJECTION:");
  console.error(err);
});

/* =========================
   ENV
========================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL_ID = "1505982167220490250";

/* =========================
   EXPRESS KEEP ALIVE
========================= */

const app = express();

app.get("/", (_, res) => {
  res.send("Bot RP Online");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🌐 Web server started");
});

/* =========================
   CLIENT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

/* =========================
   LOGIN DEBUG
========================= */

client.login(TOKEN)
  .then(() => {
    console.log("🔑 LOGIN RÉUSSI");
  })
  .catch((err) => {
    console.error("❌ LOGIN FAILED:");
    console.error(err);
  });

/* =========================
   DEPARTMENTS
========================= */

const DEPARTMENTS = {
  NYSP: {
    rootRole: "NYSP",
    ranks: [
      "Major",
      "Major Adjoint",
      "Capitaine",
      "Lieutenant",
      "Sergent",
      "Trooper Première classe",
      "Trooper",
      "Recrue"
    ],
    formateur: "Formateur NYSP",
    special: ["Investigateur", "State SWAT"],
    bypass: ["Major", "Major Adjoint", "Capitaine"],
    top: ["Major", "Major Adjoint"]
  },

  NYPD: {
    rootRole: "NYPD",
    ranks: [
      "Capitaine",
      "Capitaine Adjoint",
      "Lieutenant",
      "Sergent",
      "Officier",
      "Officier Probatoire",
      "Recrue",
      "Cadet"
    ],
    formateur: "Formateur NYPD",
    special: ["Détective", "SWAT NYPD"],
    bypass: ["Capitaine", "Capitaine Adjoint"],
    top: ["Capitaine", "Capitaine Adjoint"]
  }
};

/* =========================
   COMMANDS
========================= */

const commands = [
  new SlashCommandBuilder()
    .setName("promotion")
    .setDescription("📢 Gestion RP des promotions")
    .addUserOption(o =>
      o.setName("joueur")
        .setDescription("Joueur RP")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("Nouveau grade")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("raison")
        .setDescription("Raison RP")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Commande /promotion enregistrée");
  } catch (error) {
    console.error("❌ Slash command error:", error);
  }
})();

/* =========================
   READY DEBUG
========================= */

client.once("ready", () => {
  console.log("🤖 BOT READY EVENT TRIGGERED");
  console.log("Bot:", client.user.tag);
});

/* =========================
   PROMOTION SYSTEM
========================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "promotion") return;

  await interaction.deferReply();

  const member = interaction.options.getMember("joueur");
  const newRole = interaction.options.getRole("role");
  const reason = interaction.options.getString("raison");
  const issuer = interaction.member;

  let dept = null;
  let deptName = null;

  for (const [name, data] of Object.entries(DEPARTMENTS)) {
    if (issuer.roles.cache.some(r => r.name === data.rootRole)) {
      dept = data;
      deptName = name;
    }
  }

  if (!dept) {
    return interaction.editReply("❌ Aucun département.");
  }

  if (!member.roles.cache.some(r => r.name === dept.rootRole)) {
    return interaction.editReply("❌ Même département requis.");
  }

  const validRoles = [
    ...dept.ranks,
    dept.formateur,
    ...dept.special
  ];

  if (!validRoles.includes(newRole.name)) {
    return interaction.editReply("❌ Grade non autorisé.");
  }

  const issuerIndex = dept.ranks.findIndex(r =>
    issuer.roles.cache.some(role => role.name === r)
  );

  const targetIndex = dept.ranks.indexOf(newRole.name);

  const bypass = issuer.roles.cache.some(r =>
    dept.bypass.includes(r.name)
  );

  if (!bypass && targetIndex <= issuerIndex) {
    return interaction.editReply("❌ Tu peux seulement promouvoir vers le bas.");
  }

  const currentIndex = dept.ranks.findIndex(r =>
    member.roles.cache.some(role => role.name === r)
  );

  if (
    !bypass &&
    currentIndex !== -1 &&
    targetIndex !== -1 &&
    currentIndex - targetIndex > 1
  ) {
    return interaction.editReply("❌ Maximum 1 grade à la fois.");
  }

  const oldRanks = member.roles.cache.filter(r =>
    dept.ranks.includes(r.name)
  );

  await member.roles.remove(oldRanks);
  await member.roles.add(newRole);

  const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

  if (logChannel) {
    logChannel.send(
      `📢 PROMOTION RP\n\n👤 ${member.user.tag}\n🏅 ${newRole.name}\n📝 ${reason}\n👮 ${issuer.user.tag}\n🏛 ${deptName}`
    );
  }

  return interaction.editReply(
    `✅ ${member} promu ➜ **${newRole.name}** | ${reason}`
  );
});
