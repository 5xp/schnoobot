const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  bold,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require("discord.js");
const TikTokTTS = require("../utils/tiktok-util");
const { execute } = require("./tiktok-tts");

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

  const reply = await interaction.reply({
    content: bold("Select a voice to use."),
    components: [row],
    ephemeral: true,
  });

  const filter = i => i.customId === "voiceSelect" && i.user.id === interaction.user.id;

  const i = await reply.awaitMessageComponent({ filter, time: 60_000 }).catch(() => null);

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
    const voice = await selectVoice(interaction);

    if (!voice) return;

    execute(interaction, content, voice, false, message);
  },
};
