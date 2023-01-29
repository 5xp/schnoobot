const { SlashCommandBuilder, AttachmentBuilder, bold, blockQuote, escapeMarkdown } = require("discord.js");
const TikTokTTS = require("../utils/tiktok-util");

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
  async execute(interaction, message = null, voice = null, ephemeral = null) {
    if (!process.env.TIKTOK_SESSIONID) {
      return interaction.reply({ content: bold("TikTok session ID not set!"), ephemeral: true });
    }

    message ??= interaction.options.getString("message");
    voice ??= interaction.options.getString("voice");
    ephemeral ??= interaction.options.getBoolean("ephemeral") ?? false;

    if (!interaction.replied && !interaction.deferred) {
      interaction.deferReply({ ephemeral });
    }

    const base64 = await TikTokTTS.getTTSBase64(voice, message);
    const buffer = Buffer.from(base64, "base64");

    const attachment = new AttachmentBuilder(buffer, { name: "tts.mp3" });

    await interaction.editReply({
      content: blockQuote(escapeMarkdown(message)),
      files: [attachment],
      components: [],
      ephemeral,
    });
  },
};
