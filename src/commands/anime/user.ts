import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { ChatInputCommandInteraction } from "discord.js";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const aniUser = interaction.options.getString("anilist-user", false);
  const discordUser = interaction.options.getUser("discord-user", false) ?? interaction.user;

  await interaction.reply(errorMessage("This command is not implemented yet"));
}
