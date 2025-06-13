import { errorMessage } from "@common/reply-utils";
import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	Guild,
	GuildPremiumTier,
	InteractionContextType,
	MessageContextMenuCommandInteraction,
	MessageFlags,
	SlashCommandBuilder,
	codeBlock,
	hideLinkEmbed,
	hyperlink,
} from "discord.js";
import { ENV } from "env";
import { readFile, rename, unlink } from "fs/promises";
import { getContainer } from "./site-embeds";
import { execa } from "execa";
import { ffmpegPath, ffprobePath } from "ffmpeg-ffprobe-static";
import path from "path";

export type Payload = Record<string, any>;

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
		)
		.addBooleanOption(option =>
			option
				.setName("reencode")
				.setDescription("Automatically reencode video to be compatible with discord. Defaults to true"),
		)
		.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
		.setContexts([
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		]),
	async execute(interaction: ChatInputCommandInteraction) {
		const url = interaction.options.getString("url", true);
		const ephemeral = interaction.options.getBoolean("ephemeral", false) ?? false;
		const reencode = interaction.options.getBoolean("reencode", false) ?? false;

		if (!url.match(urlRegex)) {
			interaction.reply(errorMessage("Invalid URL."));
			return;
		}

		run({ interaction, url, ephemeral, reencode });
	},
};

type ValidInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

type RunOptions = {
	interaction: ValidInteraction;
	url: string;
	ephemeral: boolean;
	jsonOnly?: boolean;
	reencode?: boolean;
};

export async function run({
	interaction,
	url,
	ephemeral,
	jsonOnly = false,
	reencode = true,
}: RunOptions): Promise<void> {
	if (!interaction.deferred && !interaction.replied) {
		await interaction.deferReply({ ephemeral: ephemeral || interaction.isContextMenuCommand() });
	}

	const uploadLimit = getUploadLimit(interaction.guild);

	const args = ytArgs(interaction.id, uploadLimit, jsonOnly);

	let output: string, payload: Payload;

	try {
		output = await tryDownload(url, args);
		const error = detectAbortion(output);
		if (error) {
			throw new Error(error);
		}
		const fileContents = await readFile(`./temp/${interaction.id}.info.json`, "utf-8").catch(() => {
			throw new Error(error ?? "Unknown error occurred.");
		});
		payload = JSON.parse(fileContents);
	} catch (error) {
		errorReply(interaction, error, url, ephemeral, true);
		return;
	}

	// We might have a video that needs to be reencoded
	if (reencode) {
		const videoCodec = await getVideoCodec(payload.filename);
		if (videoCodec && videoCodec !== "h264") {
			await reencodeVideo({
				input: payload.filename,
			});
			const { dir, name } = path.parse(payload.filename);
			payload.filename = path.join(dir, `${name}.mp4`);
		}
	}

	try {
		await createReply(interaction, payload, ephemeral, jsonOnly);
	} catch (error) {
		errorReply(interaction, error, url, ephemeral, false);
	} finally {
		const filename = payload.filename;
		unlink(filename).catch(() => null);
		unlink(`./temp/${interaction.id}.info.json`).catch(() => null);
	}
}

function ytArgs(interactionId: string, uploadLimit: number, jsonOnly: boolean): string[] {
	const base = [
		"--format",
		"(bv[ext=mp4]+ba[ext=m4a])/b[ext=mp4]/ba[ext=mp3]/b",
		"--match-filter",
		"!is_live & !was_live & !playlist_id",
		"--format-sort",
		`vcodec:h264,filesize:${uploadLimit}M`,
		"--max-filesize",
		`${uploadLimit}M`,
		"--write-info-json",
		"--no-clean-info-json",
		"--paths",
		"./temp",
		"--output",
		`${interactionId}.%(ext)s`,
	];

	if (jsonOnly) {
		base.push("--skip-download");
	}

	if (ENV.COOKIES_FILE_NAME) {
		base.push("--cookies", ENV.COOKIES_FILE_NAME);
	}

	return base;
}

async function getVideoCodec(inputFile: string): Promise<string | null> {
	if (!ffprobePath) {
		throw new Error("ffprobe path not found");
	}

	try {
		const { stdout } = await execa(ffprobePath, [
			"-v",
			"quiet",
			"-print_format",
			"json",
			"-show_streams",
			"-select_streams",
			"v",
			inputFile,
		]);

		const info = JSON.parse(stdout);
		if (info.streams && Array.isArray(info.streams) && info.streams.length > 0 && info.streams[0].codec_name) {
			return info.streams[0].codec_name;
		} else {
			return null;
		}
	} catch (err) {
		console.error("ffprobe failed:", err);
		throw err;
	}
}

type ReencodeOptions = {
	input: string;
	preset?: string;
	crf?: number;
	audioBitrate?: string;
	overwrite?: boolean;
};

async function reencodeVideo(options: ReencodeOptions) {
	if (!ffmpegPath) {
		throw new Error("ffmpeg path not found");
	}
	const { input, preset = "medium", crf = 23, audioBitrate = "128k", overwrite = true } = options;

	const { dir, name } = path.parse(input);
	const temp = path.join(dir, `${name}.tmp.mp4`);
	const output = path.join(dir, `${name}.mp4`);

	const args: string[] = [];

	if (overwrite) {
		args.push("-y");
	}

	args.push(
		"-i",
		input,
		"-c:v",
		"libx264",
		"-preset",
		preset,
		"-crf",
		crf.toString(),
		"-c:a",
		"aac",
		"-b:a",
		audioBitrate,
		temp,
	);

	try {
		await execa(ffmpegPath, args, { timeout: 0 });
		await unlink(input);
		await rename(temp, output);
	} catch (error) {
		console.error(error);
		unlink(temp).catch(() => null);
		throw error;
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
			return 10;
	}
}

async function tryDownload(url: string, args: string[]): Promise<string> {
	const bin = "./bin/yt-dlp" + (process.platform === "win32" ? ".exe" : "");
	const { stdout } = await execa(bin, [...args, url]);
	return stdout;
}

function detectAbortion(stdout: string): string | undefined {
	const lines = stdout.split("\n");

	for (const line of lines) {
		if (line.includes("File is larger than max-filesize")) {
			// Extract file size and max file size from the message
			const match = line.match(/\((\d+) bytes > (\d+) bytes\)/);
			if (match) {
				const [_, filesizeBytes, maxFilesizeBytes] = match;
				const filesizeMB = (parseInt(filesizeBytes) / (1024 * 1024)).toFixed(1);
				const maxFilesizeMB = (parseInt(maxFilesizeBytes) / (1024 * 1024)).toFixed(1);
				return `Requested file is too large. (${filesizeMB}MB > ${maxFilesizeMB}MB)`;
			}
		} else if (line.includes("does not pass filter")) {
			return "Downloading livestreams or playlists is not supported.";
		}
	}
}

async function createReply(
	interaction: ValidInteraction,
	payload: Payload,
	ephemeral: boolean,
	jsonOnly: boolean,
): Promise<void> {
	let attachment: AttachmentBuilder | undefined;

	if (jsonOnly) {
		const buffer = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
		attachment = new AttachmentBuilder(buffer, {
			name: "info.json",
		});
	} else {
		const filename: string = payload.filename;
		attachment = new AttachmentBuilder(filename, {
			name: filename.split("/").pop(),
		});
	}

	if (!attachment.name) {
		throw new Error("Attachment name is undefined");
	}

	if (interaction.isContextMenuCommand() && !ephemeral) {
		const container = getContainer({ jsonDump: payload, useEmoji: false }, attachment.name);

		await interaction.targetMessage.reply({
			components: [container],
			files: [attachment],
			allowedMentions: { repliedUser: false },
			flags: MessageFlags.IsComponentsV2,
		});

		interaction.deleteReply();
	} else {
		const container = getContainer({ jsonDump: payload, useEmoji: true }, attachment.name);
		await interaction.editReply({
			components: [container],
			files: [attachment],
			flags: MessageFlags.IsComponentsV2,
		});
	}
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
		ephemeral: true,
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
