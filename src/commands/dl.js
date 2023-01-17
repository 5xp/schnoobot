const { unlink } = require("node:fs");
const { SlashCommandBuilder, GuildPremiumTier, AttachmentBuilder, codeBlock, bold } = require("discord.js");
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

    const format = isVideo ? "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" : "ba[ext=mp3]/ba";

    const uploadLimit = getUploadLimit(interaction.guild);

    try {
      await youtubedl(url, {
        f: format,
        formatSort: `filesize:${uploadLimit}M`,
        o: `${filePath}.%(ext)s`,
      });

      extension = (await readdir("./temp")).find(file => file.startsWith(fileName)).split(".")[1];
    } catch (error) {
      await interaction.editReply({
        content: bold(`An error occurred while downloading the file: ${codeBlock(error.stderr)}`),
        ephemeral,
      });

      return;
    }

    try {
      const attachment = new AttachmentBuilder(`${filePath}.${extension}`, {
        name: `output.${extension}`,
      });

      await interaction.editReply({ content: "", files: [attachment], ephemeral });
    } catch (error) {
      await interaction.editReply({
        content: bold("An error occurred while uploading the file! The file may be too large."),
        ephemeral,
      });
    } finally {
      unlink(`${filePath}.${extension}`, () => {
        // Ignore errors
      });
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
