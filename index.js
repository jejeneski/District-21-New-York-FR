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
   GLOBAL DEBUG / ANTI CRASH
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
  console.log(`🌐 Web server started on port ${PORT}`);
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
   LOGIN
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

    special: [
      "Investigateur",
      "State SWAT"
    ],

    bypass: [
      "Major",
      "Major Adjoint",
      "Capitaine"
    ],

    top: [
      "Major",
      "Major Adjoint"
    ]
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

    special: [
      "Détective",
      "SWAT NYPD"
    ],

    bypass: [
      "Capitaine",
      "Capitaine Adjoint"
    ],

    top: [
      "Capitaine",
      "Capitaine Adjoint"
    ]
  }

};

/* =========================
   SLASH COMMANDS
========================= */

const commands = [

  new SlashCommandBuilder()

    .setName("promotion")
    .setDescription("📢 Promotion RP")

    .addUserOption(option =>
      option
        .setName("joueur")
        .setDescription("Joueur RP")
        .setRequired(true)
    )

    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("Nouveau grade")
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName("raison")
        .setDescription("Raison RP")
        .setRequired(true)
    )

].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {

  try {

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Commande /promotion enregistrée");

  } catch (error) {

    console.error("❌ COMMAND REGISTER ERROR:");
    console.error(error);

  }

})();

/* =========================
   READY
========================= */

client.once("ready", () => {

  console.log("🤖 BOT READY EVENT");
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

});

/* =========================
   EMBED LOG
========================= */

function createPromotionEmbed({
  member,
  role,
  issuer,
  reason,
  deptName
}) {

  return new EmbedBuilder()

    .setColor("Blue")

    .setTitle("📢 Promotion RP")

    .addFields(
      {
        name: "👤 Joueur",
        value: member.user.tag
      },

      {
        name: "🏅 Nouveau grade",
        value: role.name
      },

      {
        name: "📝 Raison",
        value: reason
      },

      {
        name: "👮 Promoteur",
        value: issuer.user.tag
      },

      {
        name: "🏛 Département",
        value: deptName
      }
    )

    .setTimestamp();

}

/* =========================
   INTERACTION CREATE
========================= */

client.on("interactionCreate", async (interaction) => {

  try {

    if (!interaction.guild) return;

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName !== "promotion") return;

    await interaction.deferReply();

    /* =========================
       GET DATA SAFE
    ========================= */

    const targetUser =
      interaction.options.getUser("joueur");

    const member =
      await interaction.guild.members.fetch(targetUser.id);

    const newRole =
      interaction.options.getRole("role");

    const reason =
      interaction.options.getString("raison");

    const issuer =
      interaction.member;

    /* =========================
       FIND DEPARTMENT
    ========================= */

    let dept = null;
    let deptName = null;

    for (const [name, data] of Object.entries(DEPARTMENTS)) {

      if (
        issuer.roles.cache.some(
          role => role.name === data.rootRole
        )
      ) {

        dept = data;
        deptName = name;

      }

    }

    if (!dept) {

      return interaction.editReply(
        "❌ Aucun département RP."
      );

    }

    /* =========================
       SAME DEPARTMENT
    ========================= */

    if (
      !member.roles.cache.some(
        role => role.name === dept.rootRole
      )
    ) {

      return interaction.editReply(
        "❌ Même département requis."
      );

    }

    /* =========================
       VALID ROLE
    ========================= */

    const validRoles = [
      ...dept.ranks,
      dept.formateur,
      ...dept.special
    ];

    if (
      !validRoles.includes(newRole.name)
    ) {

      return interaction.editReply(
        "❌ Grade non autorisé."
      );

    }

    /* =========================
       RANK CHECK
    ========================= */

    const issuerIndex =
      dept.ranks.findIndex(rank =>
        issuer.roles.cache.some(
          role => role.name === rank
        )
      );

    const targetIndex =
      dept.ranks.indexOf(newRole.name);

    const bypass =
      issuer.roles.cache.some(role =>
        dept.bypass.includes(role.name)
      );

    if (
      !bypass &&
      targetIndex <= issuerIndex
    ) {

      return interaction.editReply(
        "❌ Promotion refusée."
      );

    }

    /* =========================
       MAX 1 GRADE
    ========================= */

    const currentIndex =
      dept.ranks.findIndex(rank =>
        member.roles.cache.some(
          role => role.name === rank
        )
      );

    if (
      !bypass &&
      currentIndex !== -1 &&
      targetIndex !== -1 &&
      currentIndex - targetIndex > 1
    ) {

      return interaction.editReply(
        "❌ Maximum 1 grade à la fois."
      );

    }

    /* =========================
       REMOVE OLD RANKS
    ========================= */

    const oldRanks =
      member.roles.cache.filter(role =>
        dept.ranks.includes(role.name)
      );

    await member.roles.remove(oldRanks);

    /* =========================
       ADD NEW ROLE
    ========================= */

    await member.roles.add(newRole);

    /* =========================
       LOG CHANNEL
    ========================= */

    const logChannel =
      interaction.guild.channels.cache.get(
        LOG_CHANNEL_ID
      );

    if (logChannel) {

      await logChannel.send({
        embeds: [
          createPromotionEmbed({
            member,
            role: newRole,
            issuer,
            reason,
            deptName
          })
        ]
      });

    }

    /* =========================
       SUCCESS
    ========================= */

    return interaction.editReply(
      `✅ ${member} promu ➜ **${newRole.name}**`
    );

  } catch (error) {

    console.error("❌ INTERACTION ERROR:");
    console.error(error);

    if (interaction.deferred || interaction.replied) {

      return interaction.editReply(
        "❌ Une erreur est survenue."
      );

    }

    return interaction.reply({
      content: "❌ Une erreur est survenue.",
      ephemeral: true
    });

  }

});
