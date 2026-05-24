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
   RP CONFIG
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
    console.error(error);
  }
})();

/* =========================
   HELPERS
========================= */

function getDepartment(member) {
  return Object.entries(DEPARTMENTS).find(([_, dept]) =>
    member.roles.cache.some(role => role.name === dept.rootRole)
  );
}

function getRankIndex(dept, member) {
  return dept.ranks.findIndex(rank =>
    member.roles.cache.some(role => role.name === rank)
  );
}

function isAllowedRole(dept, roleName) {
  return (
    dept.ranks.includes(roleName) ||
    dept.special.includes(roleName) ||
    roleName === dept.formateur
  );
}

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
   READY
========================= */

client.once("ready", () => {
  console.log(`🤖 RP Bot connecté : ${client.user.tag}`);
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

  const deptData = getDepartment(issuer);

  if (!deptData) {
    return interaction.editReply(
      "❌ Tu n’es dans aucun département RP."
    );
  }

  const [deptName, dept] = deptData;

  if (
    !member.roles.cache.some(role =>
      role.name === dept.rootRole
    )
  ) {
    return interaction.editReply(
      "❌ Même département requis."
    );
  }

  if (
    !isAllowedRole(dept, newRole.name) ||
    ["NYSP", "NYPD"].includes(newRole.name)
  ) {
    return interaction.editReply(
      "❌ Grade non autorisé."
    );
  }

  const issuerIndex = getRankIndex(dept, issuer);
  const targetIndex = dept.ranks.indexOf(newRole.name);

  const bypass = issuer.roles.cache.some(role =>
    dept.bypass.includes(role.name)
  );

  if (!bypass && targetIndex <= issuerIndex) {
    return interaction.editReply(
      "❌ Tu peux seulement promouvoir des grades inférieurs."
    );
  }

  const currentIndex = getRankIndex(dept, member);

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

  if (newRole.name === dept.formateur) {

    const allowed = issuer.roles.cache.some(role =>
      dept.top.includes(role.name)
    );

    if (!allowed) {
      return interaction.editReply(
        "❌ Accès Formateur refusé."
      );
    }
  }

  if (dept.special.includes(newRole.name)) {

    const allowed = issuer.roles.cache.some(role =>
      dept.top.includes(role.name) ||
      role.name === dept.formateur
    );

    if (!allowed) {
      return interaction.editReply(
        "❌ Accès rôle spécial refusé."
      );
    }
  }

  /* REMOVE OLD RANKS */

  const oldRanks = member.roles.cache.filter(role =>
    dept.ranks.includes(role.name)
  );

  await member.roles.remove(oldRanks);

  /* ADD NEW ROLE */

  await member.roles.add(newRole);

  /* LOG CHANNEL */

  const logChannel =
    interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

  if (logChannel) {

    logChannel.send({
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

  /* FINAL MESSAGE */

  return interaction.editReply(
    `✅ ${member} promu ➜ **${newRole.name}** | ${reason}`
  );

});

/* =========================
   LOGIN
========================= */

client.login(TOKEN);
