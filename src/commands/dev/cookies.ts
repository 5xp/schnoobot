import { AttachmentBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { ENV } from "env";
import { errorContainerMessage, simpleContainer } from "@common/reply-utils";
import { existsSync, writeFileSync } from "node:fs";

export default async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const filename = ENV.COOKIES_FILE_NAME;
	if (!filename) {
		await interaction.reply(errorContainerMessage("The cookies file environment variable is not configured."));

		return;
	}

	const fn = interaction.options.getSubcommand() === "get" ? getCookiesFile : uploadCookiesFile;

	fn(interaction, filename);
}

async function getCookiesFile(interaction: ChatInputCommandInteraction, filename: string) {
	if (!existsSync(filename)) {
		await interaction.reply({
			components: [simpleContainer(`The cookies file at \`${filename}\` does not exist.`)],
			flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
		});

		return;
	}

	const attachment = new AttachmentBuilder(filename);

	await interaction.reply({
		files: [attachment],
		flags: MessageFlags.Ephemeral,
	});
}

async function uploadCookiesFile(interaction: ChatInputCommandInteraction, filename: string) {
	const attachment = interaction.options.getAttachment("file");
	if (!attachment) {
		await interaction.reply(errorContainerMessage("No attachment provided."));

		return;
	}

	const response = await fetch(attachment.url);
	if (!response.ok) {
		await interaction.reply(errorContainerMessage("Failed to download file."));
		return;
	}

	const buffer = await response.arrayBuffer();

	writeFileSync(filename, Buffer.from(buffer));

	await interaction.reply({
		components: [simpleContainer("Successfully uploaded cookies")],
		flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
	});
}
