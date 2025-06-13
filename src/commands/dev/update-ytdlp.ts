import { errorMessage, simpleContainer } from "@common/reply-utils";
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { execa } from "execa";

export default async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });
	const { stdout, stderr } = await execa`npm run fetch-yt-dlp`;

	if (stderr) {
		await interaction.editReply(errorMessage(stderr));
		return;
	}

	await interaction.editReply({ components: [simpleContainer(stdout)], flags: MessageFlags.IsComponentsV2 });
}
