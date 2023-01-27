const { unlink } = require("node:fs");
const {
  SlashCommandBuilder,
  GuildPremiumTier,
  AttachmentBuilder,
  codeBlock,
  bold,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const youtubedl = require("youtube-dl-exec");
const readdir = require("util").promisify(require("node:fs").readdir);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dl")
    .setDescription("Download a video from the internet")
    .addSubcommand(subcommand =>
      subcommand
        .setName("video")
        .setDescription("Download a video from the internet")
        .addStringOption(option =>
          option.setName("url").setDescription("The URL of the video to download").setRequired(true),
        )
        .addBooleanOption(option =>
          option.setName("ephemeral").setDescription("Whether the response should be ephemeral").setRequired(false),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("audio")
        .setDescription("Download an audio file from the internet")
        .addStringOption(option =>
          option.setName("url").setDescription("The URL of the audio file to download").setRequired(true),
        )
        .addBooleanOption(option =>
          option.setName("ephemeral").setDescription("Whether the response should be ephemeral").setRequired(false),
        ),
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const url = interaction.options.getString("url");
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

    interaction.deferReply({ ephemeral });

    const isVideo = subcommand === "video";

    const fileName = `${interaction.user.id}-${Date.now()}`;
    const filePath = `./temp/${fileName}`;
    let extension;

    const uploadLimit = getUploadLimit(interaction.guild);

    const format = isVideo ? "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" : "ba[ext=mp3]/ba";
    const options = {
      f: format,
      formatSort: `vcodec:h264,filesize:${uploadLimit}M`,
      o: `${filePath}.%(ext)s`,
    };

    let output, jsonDump;

    try {
      output = youtubedl(url, options);

      jsonDump = youtubedl(url, {
        ...options,
        dumpSingleJson: true,
      });

      [output, jsonDump] = await Promise.all([output, jsonDump]);

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

      let linkLabel = jsonDump.webpage_url_domain;

      if (jsonDump.channel) {
        linkLabel += ` @${jsonDump.channel}`;
      } else if (jsonDump.uploader) {
        linkLabel += ` @${jsonDump.uploader}`;
      }

      const linkButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(linkLabel)
        .setURL(jsonDump.webpage_url);

      const linkRow = new ActionRowBuilder().addComponents(linkButton);

      await interaction.editReply({ content: "", files: [attachment], components: [linkRow], ephemeral });
    } catch (error) {
      console.error(error);
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
