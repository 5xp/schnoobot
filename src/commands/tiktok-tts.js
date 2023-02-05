const {
  SlashCommandBuilder,
  AttachmentBuilder,
  bold,
  blockQuote,
  escapeMarkdown,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const TikTokTTS = require("../utils/tiktok-util");

const deleteButton = new ButtonBuilder().setCustomId("delete").setEmoji("🗑️").setStyle(ButtonStyle.Primary);
const row = new ActionRowBuilder().addComponents(deleteButton);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tiktok-tts")
    .setDescription("Uses TikTok's TTS to speak a message.")
    .addStringOption(option => option.setName("message").setDescription("The message to speak.").setRequired(true))
    .addStringOption(option =>
      option
        .setName("voice")
        .setDescription("The voice to use.")
        .setRequired(true)
        .addChoices(...TikTokTTS.voiceStringOptionChoices),
    )
    .addBooleanOption(option =>
      option.setName("ephemeral").setDescription("Whether the response should be ephemeral.").setRequired(false),
    ),
  async execute(interaction, message = null, voice = null, ephemeral = null, targetMessage = null) {
    if (!process.env.TIKTOK_SESSIONID) {
      return interaction.reply({ content: bold("TikTok session ID not set!"), ephemeral: true });
    }

    message ??= interaction.options.getString("message");
    voice ??= interaction.options.getString("voice");
    ephemeral ??= interaction.options.getBoolean("ephemeral") ?? false;

    const isContextMenuCommand = interaction.isContextMenuCommand();

    if (!interaction.replied && !interaction.deferred) {
      interaction.deferReply({ ephemeral });
    }

    const base64 = await TikTokTTS.getTTSBase64(voice, message);
    const buffer = Buffer.from(base64, "base64");

    const attachment = new AttachmentBuilder(buffer, { name: `tiktok-tts-${voice}.mp3` });

    let reply;

    if (isContextMenuCommand) {
      reply = await targetMessage.reply({
        content: bold(`Requested by ${interaction.user}`),
        files: [attachment],
        allowedMentions: { repliedUser: false },
        components: [row],
      });

      interaction.deleteReply();
    } else {
      reply = await interaction.editReply({
        content: blockQuote(escapeMarkdown(message)),
        files: [attachment],
        components: [row],
        ephemeral,
      });
    }

    const filter = i => i.customId === "delete" && i.user.id === interaction.user.id;

    const i = await reply.awaitMessageComponent({ filter, time: 180_000 }).catch(() => null);

    if (!i) {
      return;
    }

    if (isContextMenuCommand) {
      await reply.delete();
      return;
    }

    interaction.deleteReply();
  },
};
