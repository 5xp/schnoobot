import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Guild,
  GuildPremiumTier,
  InteractionResponse,
  Message,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  bold,
  codeBlock,
  hideLinkEmbed,
  hyperlink,
} from "discord.js";
import { unlink } from "fs";
import youtubeDl, { Flags, Payload } from "youtube-dl-exec";
import { getEmbed } from "./site-embeds";

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

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
  isUserCommand: true,
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const url = interaction.options.getString("url", true);
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

    if (!url.match(urlRegex)) {
      interaction.reply(errorMessage("Invalid URL."));
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
  const options: Flags = {
    format: format,
    formatSort: `vcodec:h264,filesize:${uploadLimit}M`,
    maxFilesize: `${uploadLimit}M`,
    output: `${filePath}.%(ext)s`,
    playlistItems: "1",
  } as Flags;

  let jsonDump: Payload, extension: string;

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

async function tryDownload(url: string, options: Flags) {
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
    const reason = jsonDumpResult.status === "rejected" ? jsonDumpResult.reason : null;

    throw reason;
  }

  // This is incorrectly typed as Payload, but it's actually a string in most cases
  const output = outputResult.value as unknown as string;
  const jsonDump = jsonDumpResult.value;

  if (typeof output === "string" && output.includes("Aborting.")) {
    let errorString = "The requested media is too large.";

    const sizeString = output.match(/\d+(?= bytes >)/);

    if (sizeString) {
      const size = Number(sizeString[0]) / 1_000_000;
      errorString += ` (${size.toFixed(2)}MB)`;
    }

    throw new Error(errorString);
  } else if (typeof output !== "string") {
    console.error("Expected output to be a string:");
    console.error(output);
  }

  const extension = getExtension(jsonDump);

  if (!extension) {
    throw new Error("Unable to determine file extension.");
  }

  return { jsonDump, extension };
}

async function handleDownloadError(interaction: ValidInteraction, url: string, error: unknown, ephemeral: boolean) {
  if (!ephemeral) {
    await interaction.deleteReply();
  }

  let errorString = hyperlink("An error occured while downloading media", hideLinkEmbed(url));

  if (error instanceof Error) {
    errorString += `: ${codeBlock(error.message)}`;
  } else {
    errorString += ".";
  }

  errorReply(interaction, error, errorString, url);
}

async function handleUploadError(interaction: ValidInteraction, url: string, error: unknown, ephemeral: boolean) {
  if (!ephemeral) {
    await interaction.deleteReply();
  }

  let errorString = hyperlink("An error occured while uploading media", hideLinkEmbed(url));

  if (error instanceof Error) {
    errorString += `: ${codeBlock(error.message)}`;
  } else {
    errorString += ".";
  }

  errorReply(interaction, error, errorString, url);
}

async function errorReply(interaction: ValidInteraction, error: unknown, errorString: string, url: string) {
  const logButton = new ButtonBuilder().setCustomId("log").setLabel("Log Error").setStyle(ButtonStyle.Secondary);

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(logButton);

  const response = await interaction.followUp({
    ...errorMessage(errorString),
    components: [actionRow],
  });

  const i = await response.awaitMessageComponent({ time: 120_000 }).catch(() => null);

  if (!i) {
    return;
  }

  if (i.customId === "log") {
    console.error(url, error);
    i.reply({ content: "The error has been logged.", ephemeral: true });
  }
}

function getExtension(jsonDump: any): string | undefined {
  const isPlaylist = jsonDump._type === "playlist";
  const media = isPlaylist ? jsonDump.entries?.[0] : jsonDump;
  return media?.ext ?? media?.filename?.split(".")?.pop();
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

  const embed = getEmbed(jsonDump);

  if (interaction.isContextMenuCommand() && !ephemeral) {
    reply = await interaction.targetMessage.reply({
      content: bold(`Requested by ${interaction.user}`),
      embeds: [embed],
      files: [attachment],
      allowedMentions: { repliedUser: false },
    });

    interaction.deleteReply();
  } else {
    reply = await interaction.editReply({
      content: "",
      embeds: [embed],
      files: [attachment],
    });
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
  jsonDump: Payload;
  ephemeral: boolean;
};
