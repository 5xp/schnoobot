import { unlink } from "fs";
import {
  SlashCommandBuilder,
  GuildPremiumTier,
  AttachmentBuilder,
  codeBlock,
  bold,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Guild,
  Message,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  hyperlink,
  hideLinkEmbed,
  InteractionResponse,
} from "discord.js";
import youtubeDl, { YtFlags, YtResponse } from "youtube-dl-exec";
import ExtendedClient from "@common/ExtendedClient";

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
const deleteButton = new ButtonBuilder().setCustomId("delete").setEmoji("🗑️").setStyle(ButtonStyle.Secondary);

export default {
  data: new SlashCommandBuilder()
    .setName("dl")
    .setDescription("Download a video from the internet")
    .addStringOption(option =>
      option.setName("url").setDescription("The URL of the video to download").setRequired(true),
    )
    .addBooleanOption(option =>
      option.setName("ephemeral").setDescription("Whether the response should be ephemeral").setRequired(false),
    ),
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const url = interaction.options.getString("url", true);
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

    if (!url.match(urlRegex)) {
      interaction.reply({ content: bold("Invalid URL."), ephemeral: true });
      return;
    }

    run({ interaction, url, ephemeral });
  },
};

export async function run({ interaction, url, ephemeral }: DlRunOptions): Promise<void> {
  const isContextMenuCommand = interaction.isContextMenuCommand();

  let deferPromise: Promise<InteractionResponse> | null = null;

  if (!interaction.deferred && !interaction.replied) {
    deferPromise = interaction.deferReply({ ephemeral: ephemeral || isContextMenuCommand });
  }

  const fileName = `${interaction.user.id}-${Date.now()}`;
  const filePath = `./temp/${fileName}`;

  const uploadLimit = getUploadLimit(interaction.guild);

  const format = "(bv[ext=mp4]+ba[ext=m4a])/b[ext=mp4]/b";
  const options: YtFlags = {
    format: format,
    formatSort: `vcodec:h264,filesize:${uploadLimit}M`,
    maxFilesize: `${uploadLimit}M`,
    output: `${filePath}.%(ext)s`,
  } as YtFlags;

  let jsonDump: YtResponse, extension: string;

  try {
    ({ jsonDump, extension } = await tryDownload(url, options));
  } catch (error) {
    handleDownloadError(interaction, url, error, ephemeral);
    return;
  }

  let reply: Message;

  try {
    await deferPromise;
    reply = await createReply({ interaction, filePath, extension, jsonDump, ephemeral });
  } catch (error) {
    handleUploadError(interaction, url, error, ephemeral);
    return;
  } finally {
    unlink(`${filePath}.${extension}`, () => null);
  }

  handleComponentInteraction(interaction, reply);
}

function getUploadLimit(guild: Guild | null): number {
  const premiumTier = guild?.premiumTier;

  switch (premiumTier) {
    case GuildPremiumTier.Tier2:
      return 50;

    case GuildPremiumTier.Tier3:
      return 100;

    default:
      return 25;
  }
}

async function tryDownload(url: string, options: YtFlags) {
  const promises = [
    youtubeDl(url, options),
    youtubeDl(url, {
      ...options,
      dumpSingleJson: true,
    }),
  ];

  const results = await Promise.allSettled(promises);

  const [outputResult, jsonDumpResult] = results;

  if (outputResult.status === "rejected" || jsonDumpResult.status === "rejected") {
    const reason = outputResult.status === "rejected" ? outputResult.reason : null;

    throw reason;
  }

  const output = outputResult.value as unknown as string;
  const jsonDump = jsonDumpResult.value;

  if (output.includes("Aborting.")) {
    let errorString = "The requested media is too large.";

    const sizeString = output.match(/\d+(?= bytes >)/);

    if (sizeString) {
      const size = Number(sizeString[0]) / 1_000_000;
      errorString += ` (${size.toFixed(2)}MB)`;
    }

    throw new Error(errorString);
  }

  const extension = jsonDump.ext;

  return { jsonDump, extension };
}

async function handleDownloadError(interaction: ValidInteraction, url: string, error: unknown, ephemeral: boolean) {
  console.error(url, error);

  if (!ephemeral) {
    await interaction.deleteReply();
  }

  let errorString = hyperlink("An error occured while downloading media", hideLinkEmbed(url));

  if (error instanceof Error) {
    errorString += `: ${codeBlock(error.message)}`;
  } else {
    errorString += ".";
  }

  await interaction.followUp({
    content: bold(errorString),
    ephemeral: true,
  });
}

async function handleUploadError(interaction: ValidInteraction, url: string, error: unknown, ephemeral: boolean) {
  console.error(url, error);

  if (!ephemeral) {
    await interaction.deleteReply();
  }

  let errorString = hyperlink("An error occured while uploading media", hideLinkEmbed(url));

  if (error instanceof Error) {
    errorString += `: ${codeBlock(error.message)}`;
  } else {
    errorString += ".";
  }

  await interaction.followUp({
    content: bold(errorString),
    ephemeral: true,
  });
}

function getLabel(jsonDump: YtResponse) {
  let linkLabel = jsonDump.extractor;

  if (["generic", "html5"].includes(linkLabel) && "webpage_url_domain" in jsonDump) {
    linkLabel = jsonDump.webpage_url_domain as string;
  }

  if (jsonDump.channel) {
    linkLabel += ` @${jsonDump.channel}`;
  } else if (jsonDump.uploader) {
    linkLabel += ` @${jsonDump.uploader}`;
  }

  return linkLabel;
}

async function handleComponentInteraction(interaction: ValidInteraction, reply: Message) {
  const filter = (i: MessageComponentInteraction) => i.customId === "delete" && i.user.id === interaction.user.id;

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

async function createReply({
  interaction,
  filePath,
  extension,
  jsonDump,
  ephemeral,
}: DlReplyOptions): Promise<Message> {
  let reply;

  const attachment = new AttachmentBuilder(`${filePath}.${extension}`, {
    name: `output.${extension}`,
  });

  const linkLabel = getLabel(jsonDump);

  const linkButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(linkLabel).setURL(jsonDump.webpage_url);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton);

  if (!ephemeral) {
    row.addComponents(deleteButton);
  }

  if (interaction.isContextMenuCommand() && !ephemeral) {
    reply = await interaction.targetMessage.reply({
      content: bold(`Requested by ${interaction.user}`),
      files: [attachment],
      components: [row],
      allowedMentions: { repliedUser: false },
    });

    interaction.deleteReply();
  } else {
    reply = await interaction.editReply({ content: "", files: [attachment], components: [row] });
  }

  return reply;
}

type ValidInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

type DlRunOptions = {
  interaction: ValidInteraction;
  url: string;
  ephemeral: boolean;
};

type DlReplyOptions = {
  interaction: ValidInteraction;
  filePath: string;
  extension: string;
  jsonDump: YtResponse;
  ephemeral: boolean;
};
