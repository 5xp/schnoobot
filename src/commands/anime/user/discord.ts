import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { ChatInputCommandInteraction } from "discord.js";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
  await interaction.reply(errorMessage("This command is not yet implemented"));
}
