const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  bold,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  blockQuote,
} = require("discord.js");
const TikTokTTS = require("../utils/tiktok-util");

async function selectVoice(interaction) {
  const voiceSelect = new StringSelectMenuBuilder()
    .setCustomId("voiceSelect")
    .setPlaceholder("Voice options")
    .addOptions(
      TikTokTTS.voiceStringOptionChoices.map(voice => {
        return {
          label: voice.name,
          value: voice.value,
        };
      }),
    );

  const row = new ActionRowBuilder().addComponents(voiceSelect);

  await interaction.reply({ content: bold("Select a voice to use."), components: [row] });

  const filter = i => i.customId === "voiceSelect" && i.user.id === interaction.user.id;

  const i = await interaction.channel.awaitMessageComponent({ filter, time: 15_000 }).catch(() => null);

  if (!i) {
    interaction.deleteReply();
    return;
  }

  return i.values[0];
}

module.exports = {
  data: new ContextMenuCommandBuilder().setName("TikTok TTS").setType(ApplicationCommandType.Message),
  async execute(interaction) {
    const message = interaction.targetMessage;
    const content = message.cleanContent;

    if (!content) {
      return interaction.reply({ content: bold("There is no text to convert to speech!"), ephemeral: true });
    }

    if (!process.env.TIKTOK_SESSIONID) {
      return interaction.reply({ content: bold("TikTok session ID not set!"), ephemeral: true });
    }

    const voice = await selectVoice(interaction);

    if (!voice) return;

    const base64 = await TikTokTTS.getTTSBase64(voice, content);
    const buffer = Buffer.from(base64, "base64");

    const attachment = new AttachmentBuilder(buffer, { name: "tts.mp3" });

    await interaction.editReply({ content: blockQuote(content), files: [attachment], components: [] });
  },
};
