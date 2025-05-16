import ExtendedClient from "@common/ExtendedClient";
import { errorMessage, simpleEmbed } from "@common/reply-utils";
import { ChatInputCommandInteraction } from "discord.js";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const { exec } = require("child_process");

	exec(
		'npm run postinstall --prefix node_modules/youtube-dl-exec --YOUTUBE_DL_HOST="https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest"',
		(error: any, stdout: any, stderr: any) => {
			if (error) {
				interaction.editReply(errorMessage("Failed to update youtube-dl"));
				return;
			}

			interaction.editReply({ embeds: [simpleEmbed("Updated youtube-dl")] });
		},
	);
}
