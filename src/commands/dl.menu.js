const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  GuildPremiumTier,
  codeBlock,
  bold,
  AttachmentBuilder,
} = require("discord.js");
const youtubedl = require("youtube-dl-exec");
const readdir = require("util").promisify(require("node:fs").readdir);
const { unlink } = require("node:fs");

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

function getUploadLimit(guild) {
  const premiumTier = guild?.premiumTier;

  switch (premiumTier) {
    case GuildPremiumTier.Tier2:
      return 50;

    case GuildPremiumTier.Tier3:
      return 100;

    default:
      return 8;
  }
}

async function selectUrl(interaction, urls, ephemeral) {
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

  const reply = await interaction.reply({ content: bold("Select a URL to download."), components: [row], ephemeral });

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
  async execute(interaction, ephemeral = false) {
    const message = interaction.targetMessage;

    let urls = message.content.match(urlRegex);

    if (!urls) {
      return interaction.reply({ content: bold("No URLs found in message!"), ephemeral: true });
    }

    urls = [...new Set(urls)];

    let url;

    if (urls.length > 1) {
      url = await selectUrl(interaction, urls, ephemeral);
    } else {
      url = urls[0];
      interaction.deferReply({ ephemeral });
    }

    if (!url) return;

    const fileName = `${interaction.user.id}-${Date.now()}`;
    const filePath = `./temp/${fileName}`;
    let extension;

    const format = "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b";

    const uploadLimit = getUploadLimit(interaction.guild);

    try {
      await youtubedl(url, {
        f: format,
        formatSort: `vcodec:h264,filesize:${uploadLimit}M`,
        o: `${filePath}.%(ext)s`,
      });

      extension = (await readdir("./temp")).find(file => file.startsWith(fileName)).split(".")[1];
    } catch (error) {
      console.error(error);

      await interaction.editReply({
        content: bold("An error occurred while downloading the media!"),
        ephemeral,
      });

      interaction.followUp({
        content: bold(`An error occurred while downloading media from <${url}>:`) + codeBlock(error.stderr),
        ephemeral: true,
      });

      setTimeout(() => {
        interaction.deleteReply();
      }, 5_000);

      return;
    }

    try {
      const attachment = new AttachmentBuilder(`${filePath}.${extension}`, {
        name: `output.${extension}`,
      });

      await interaction.editReply({ content: "", files: [attachment], components: [] });
    } catch (error) {
      await interaction.editReply({
        content: bold("An error occurred while uploading the file! The file may be too large."),
        ephemeral,
      });

      setTimeout(() => {
        interaction.deleteReply();
      }, 5_000);
    } finally {
      unlink(`${filePath}.${extension}`, () => null);
    }
  },
};
