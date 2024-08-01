import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import { ChatInputCommandInteraction, MessageContextMenuCommandInteraction, SlashCommandBuilder } from "discord.js";
import { run, urlRegex } from "./dl";

export default {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Get information about a video from the internet")
    .addStringOption(option =>
      option.setName("url").setDescription("The URL of the video to get information about").setRequired(true),
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

    run({ interaction, url, ephemeral, jsonOnly: true });
  },
};
