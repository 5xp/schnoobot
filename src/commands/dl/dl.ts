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
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  codeBlock,
  hideLinkEmbed,
  hyperlink,
} from "discord.js";
import { Readable } from "stream";
import youtubeDl, { Flags, Payload } from "youtube-dl-exec";
import { getMessage } from "./site-embeds";

export const urlRegex =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

export default {
  data: new SlashCommandBuilder()
    .setName("dl")
    .setDescription("Download media from the internet")
    .addStringOption(option =>
      option.setName("url").setDescription("The URL of the media to download").setRequired(true),
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

export async function run({ interaction, url, ephemeral, jsonOnly }: DlRunOptions): Promise<void> {
  const isContextMenuCommand = interaction.isContextMenuCommand();

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: ephemeral || isContextMenuCommand });
  }

  const uploadLimit = getUploadLimit(interaction.guild);

  const options: Flags = jsonOnly
    ? {}
    : ({
        format: "(bv[ext=mp4]+ba[ext=m4a])/b[ext=mp4]/ba[ext=mp3]/b",
        formatSort: `vcodec:h264,filesize:${uploadLimit}M`,
        maxFilesize: `${uploadLimit}M`,
        noProgress: true,
        playlistItems: "1",
      } as Flags);

  let buffer: Buffer, jsonDump: Payload, extension: string;

  try {
    ({ buffer, jsonDump, extension } = await tryDownload(url, options));
  } catch (error) {
    errorReply(interaction, error, url, ephemeral, true);
    return;
  }

  try {
    await createReply({ interaction, buffer, extension, jsonDump, ephemeral, jsonOnly });
  } catch (error) {
    errorReply(interaction, error, url, ephemeral, false);
  }
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

type DownloadResult = {
  buffer: Buffer;
  output: string;
};

async function downloadToBuffer(url: string, options: any): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const process = youtubeDl.exec(url, options, { stdio: ["ignore", "pipe", "pipe"] });

    if (!process.stdout || !process.stderr) {
      throw new Error("Unable to read process streams.");
    }

    process.catch(reject);

    const promises = [readStream(process.stdout), readStream(process.stderr)];

    Promise.all(promises)
      .then(([buffer, output]) => resolve({ buffer, output: output.toString("utf-8") }))
      .catch(reject);
  });
}

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on("data", chunk => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on("error", reject);
  });
}

function isDownloadResult(result: unknown): result is DownloadResult {
  return typeof result === "object" && result !== null && "buffer" in result && Buffer.isBuffer(result.buffer);
}

function isPayload(result: unknown): result is Payload {
  return typeof result === "object" && result !== null && "_type" in result;
}

async function tryDownload(url: string, options: Flags, jsonOnly = false) {
  const promises: Promise<DownloadResult | Payload>[] = [];

  promises.push(youtubeDl(url, { ...options, dumpSingleJson: true }));

  if (!jsonOnly) {
    promises.push(downloadToBuffer(url, { ...options, output: "-" }));
  }

  const results = await Promise.allSettled(promises);

  const [jsonDumpResult, downloadResultResult] = results;

  if (downloadResultResult.status === "rejected" || jsonDumpResult.status === "rejected") {
    const reason = results.find(result => result.status === "rejected")?.reason;

    throw reason;
  }

  if (!isPayload(jsonDumpResult.value)) {
    throw new Error("Unexpected result from download.");
  }

  if (jsonOnly) {
    return { jsonDump: jsonDumpResult.value, buffer: Buffer.from([]), extension: "" };
  }

  if (!isDownloadResult(downloadResultResult.value)) {
    throw new Error("Unexpected result from download.");
  }

  const downloadResult = downloadResultResult.value;

  if (downloadResult.output.includes("File is larger than max-filesize")) {
    let errorString = "The requested media is too large.";

    const sizeString = downloadResult.output.match(/\d+(?= bytes >)/);

    if (sizeString) {
      const size = Number(sizeString[0]) / 1_000_000;
      errorString += ` (${size.toFixed(2)}MB)`;
    }

    throw new Error(errorString);
  }

  const jsonDump = jsonDumpResult.value;

  const extension = getExtension(jsonDump);

  if (!extension) {
    throw new Error("Unable to determine file extension.");
  }

  return { buffer: downloadResult.buffer, jsonDump, extension };
}

async function errorReply(
  interaction: ValidInteraction,
  error: unknown,
  url: string,
  ephemeral: boolean,
  isDownloadError: boolean,
) {
  if (!ephemeral) {
    await interaction.deleteReply();
  }

  let errorString = `An error occured while ${isDownloadError ? "downloading" : "uploading"} media`;
  errorString = hyperlink(errorString, hideLinkEmbed(url));

  errorString += error instanceof Error ? `: ${codeBlock(error.message)}` : ".";

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

async function createReply({
  interaction,
  buffer,
  extension,
  jsonDump,
  ephemeral,
  jsonOnly,
}: DlReplyOptions): Promise<void> {
  let attachment: AttachmentBuilder;

  if (jsonOnly) {
    const buffer = Buffer.from(JSON.stringify(jsonDump, null, 2), "utf-8");
    attachment = new AttachmentBuilder(buffer, {
      name: "info.json",
    });
  } else {
    attachment = new AttachmentBuilder(buffer, {
      name: `?.${extension}`,
    });
  }

  if (interaction.isContextMenuCommand() && !ephemeral) {
    const message = getMessage({ jsonDump, useEmoji: false });
    await interaction.targetMessage.reply({
      content: "" + "\n" + message,
      files: [attachment],
      allowedMentions: { repliedUser: false },
    });

    interaction.deleteReply();
  } else {
    const message = getMessage({ jsonDump, useEmoji: true });
    await interaction.editReply({
      content: message,
      files: [attachment],
    });
  }
}

type ValidInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

type DlRunOptions = {
  interaction: ValidInteraction;
  url: string;
  ephemeral: boolean;
  jsonOnly?: boolean;
};

type DlReplyOptions = {
  interaction: ValidInteraction;
  buffer: Buffer;
  extension: string;
  jsonDump: Payload;
  ephemeral: boolean;
  jsonOnly?: boolean;
};
