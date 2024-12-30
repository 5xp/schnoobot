import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { ChatInputCommandInteraction, MessageContextMenuCommandInteraction, SlashCommandBuilder } from "discord.js";
import { run, urlRegex } from "../dl/dl";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
  const url = interaction.options.getString("url", true);

  if (!url.match(urlRegex)) {
    interaction.reply(errorMessage("Invalid URL."));
    return;
  }

  run({ interaction, url, ephemeral: true, jsonOnly: true });
}
