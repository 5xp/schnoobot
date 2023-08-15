const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  bold,
} = require("discord.js");
const { execute } = require("./dl");

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

async function selectUrl(interaction, urls) {
  const urlSelect = new StringSelectMenuBuilder()
    .setCustomId("urlSelect")
    .setPlaceholder("Select a URL")
    .addOptions(
      urls.map(url => {
        return {
          label: url,
          value: url,
        };
      }),
    );

  const row = new ActionRowBuilder().addComponents(urlSelect);

  const reply = await interaction.reply({
    content: bold("Select a URL to download."),
    components: [row],
    ephemeral: true,
  });

  const filter = i => i.customId === "urlSelect" && i.user.id === interaction.user.id;

  const i = await reply.awaitMessageComponent({ filter, time: 10_000 }).catch(() => null);

  if (!i) {
    interaction.deleteReply();
    return;
  }

  const selectedUrl = i.values[0];

  i.update({ content: bold(`🚀 [Downloading...](<${selectedUrl}>)`), components: [] });
  return selectedUrl;
}

module.exports = {
  data: new ContextMenuCommandBuilder().setName("Download Videos").setType(ApplicationCommandType.Message),
  async execute(interaction, client, ephemeral = false) {
    const message = interaction.targetMessage;

    let urls = message.content.match(urlRegex);

    if (!urls) {
      return interaction.reply({ content: bold("No URLs found in message!"), ephemeral: true });
    }

    urls = [...new Set(urls)];

    let url;

    if (urls.length > 1) {
      url = await selectUrl(interaction, urls);
    } else {
      url = urls[0];
    }

    if (!url) return;

    execute(interaction, client, url, ephemeral, "video", message);
  },
};
