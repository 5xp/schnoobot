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

const deleteButton = new ButtonBuilder().setCustomId("delete").setEmoji("🗑️").setStyle(ButtonStyle.Secondary);

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
  async execute(interaction, url = null, ephemeral = null, subcommand = null, targetMessage = null) {
    subcommand ??= interaction.options.getSubcommand();
    url ??= interaction.options.getString("url");
    ephemeral ??= interaction.options.getBoolean("ephemeral");

    const isContextMenuCommand = interaction.isContextMenuCommand();

    if (!interaction.deferred && !interaction.replied) {
      interaction.deferReply({ ephemeral: ephemeral || isContextMenuCommand });
    }

    const isVideo = subcommand === "video";

    const fileName = `${interaction.user.id}-${Date.now()}`;
    const filePath = `./temp/${fileName}`;

    const uploadLimit = getUploadLimit(interaction.guild);

    const format = isVideo ? "(bv[ext=mp4]+ba[ext=m4a])/b[ext=mp4]/b" : "ba[ext=mp3]/ba";
    const options = {
      f: format,
      formatSort: `vcodec:h264,filesize:${uploadLimit}M`,
      maxFilesize: `${uploadLimit}M`,
      o: `${filePath}.%(ext)s`,
    };

    let jsonDump, extension;

    try {
      ({ jsonDump, extension } = await tryDownload(url, options));
    } catch (error) {
      handleDownloadError(interaction, error, ephemeral);
      return;
    }

    let reply;

    try {
      reply = await createReply(interaction, filePath, extension, jsonDump, targetMessage, ephemeral);
    } catch (error) {
      handleUploadError(interaction, error, ephemeral);
      return;
    } finally {
      unlink(`${filePath}.${extension}`, () => null);
    }

    handleComponentInteraction(interaction, reply);
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

async function tryDownload(url, options) {
  const output = await youtubedl(url, options);
  const jsonDump = await youtubedl(url, {
    ...options,
    dumpSingleJson: true,
  });

  if (output.includes("Aborting.")) {
    const size = +output.match(/\d+(?= bytes >)/) / 1_000_000;
    const error = new Error();
    error.stderr = `The requested media is too large (${size.toFixed(2)}MB).`;
    throw error;
  }

  const extension =
    jsonDump.ext ?? (await readdir("./temp")).find(file => file.startsWith(options.output)).split(".")[1];

  return { output, jsonDump, extension };
}

async function handleDownloadError(interaction, error, ephemeral) {
  console.error(error);

  if (!ephemeral) {
    await interaction.deleteReply();
  }

  await interaction.followUp({
    content: bold("An error occurred while downloading media:") + codeBlock(error.stderr),
    ephemeral: true,
  });
}

async function handleUploadError(interaction, error, ephemeral) {
  console.error(error);

  if (!ephemeral) {
    await interaction.deleteReply();
  }

  await interaction.followUp({
    content: bold("An error occurred while uploading media:" + codeBlock(error.message)),
    ephemeral: true,
  });
}

function getLabel(jsonDump) {
  let linkLabel = jsonDump.extractor;

  if (["generic", "html5"].includes(linkLabel)) {
    linkLabel = jsonDump.webpage_url_domain;
  }

  if (jsonDump.channel) {
    linkLabel += ` @${jsonDump.channel}`;
  } else if (jsonDump.uploader) {
    linkLabel += ` @${jsonDump.uploader}`;
  }

  return linkLabel;
}

async function handleComponentInteraction(interaction, reply) {
  const filter = i => i.customId === "delete" && i.user.id === interaction.user.id;

  const i = await reply.awaitMessageComponent({ filter, time: 180_000 }).catch(() => null);

  if (!i) {
    return;
  }

  if (interaction.isContextMenuCommand()) {
    await reply.delete();
    return;
  }

  interaction.deleteReply();
}

async function createReply(interaction, filePath, extension, jsonDump, targetMessage, ephemeral) {
  let reply;

  const attachment = new AttachmentBuilder(`${filePath}.${extension}`, {
    name: `output.${extension}`,
  });

  const linkLabel = getLabel(jsonDump);

  const linkButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(linkLabel).setURL(jsonDump.webpage_url);

  const row = new ActionRowBuilder().addComponents(linkButton);

  if (!ephemeral) {
    row.addComponents(deleteButton);
  }

  if (interaction.isContextMenuCommand() && !ephemeral) {
    reply = await targetMessage.reply({
      content: bold(`Requested by ${interaction.user}`),
      files: [attachment],
      components: [row],
      allowedMentions: { repliedUser: false },
    });

    interaction.deleteReply();
  } else {
    reply = await interaction.editReply({ content: "", files: [attachment], components: [row], ephemeral });
  }

  return reply;
}
