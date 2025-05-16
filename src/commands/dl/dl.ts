import ExtendedClient from "@common/ExtendedClient";
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
import { readFile, unlink } from "fs/promises";
import youtubeDl, { Flags, Payload } from "youtube-dl-exec";
import { getContainer, getMessage } from "./site-embeds";

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
		.setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
		.setContexts([
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		]),
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

type ValidInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

type RunOptions = {
	interaction: ValidInteraction;
	url: string;
	ephemeral: boolean;
	jsonOnly?: boolean;
};

export async function run({ interaction, url, ephemeral, jsonOnly = false }: RunOptions): Promise<void> {
	if (!interaction.deferred && !interaction.replied) {
		await interaction.deferReply({ ephemeral: ephemeral || interaction.isContextMenuCommand() });
	}

	const uploadLimit = getUploadLimit(interaction.guild);

	const options: Flags = {
		format: "(bv[ext=mp4]+ba[ext=m4a])/b[ext=mp4]/ba[ext=mp3]/b",
		matchFilter: "!is_live & !was_live & !playlist_id",
		formatSort: `vcodec:h264,filesize:${uploadLimit}M` as any, // the typings are wrong
		maxFilesize: `${uploadLimit}M`,
		writeInfoJson: true,
		noCleanInfoJson: true,
		paths: "./temp",
		output: `${interaction.id}.%(ext)s`,
	} as Flags;

	if (jsonOnly) {
		options.skipDownload = true;
	}

	if (ENV.COOKIES_FILE_NAME) {
		options.cookies = ENV.COOKIES_FILE_NAME;
	}

	let output: string, payload: Payload;

	try {
		output = await tryDownload(url, options);
		const fileContents = await readFile(`./temp/${interaction.id}.info.json`, "utf-8").catch(() => {
			throw new Error(detectAbortion(output));
		});
		payload = JSON.parse(fileContents) as Payload;
	} catch (error) {
		errorReply(interaction, error, url, ephemeral, true);
		return;
	}

	try {
		await createReply(interaction, payload, ephemeral, jsonOnly);
	} catch (error) {
		errorReply(interaction, error, url, ephemeral, false);
	} finally {
		const filename = (payload as any).filename; // the typings are wrong
		unlink(filename).catch(() => null);
		unlink(`./temp/${interaction.id}.info.json`).catch(() => null);
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

async function tryDownload(url: string, options: Flags): Promise<string> {
	try {
		return (await youtubeDl.exec(url, options)).stdout;
	} catch (error) {
		const stderr = (error as { stderr?: string })?.stderr ?? "";
		if (stderr) {
			throw new Error(stderr);
		}

		throw error;
	}
}

function detectAbortion(stdout: string): string {
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

	return "Unknown error occurred.";
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
		const filename: string = (payload as any).filename; // the typings are wrong
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
