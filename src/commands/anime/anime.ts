import ExtendedClient from "@common/ExtendedClient";
import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("anime")
    .setDescription("anime commands")
    .addSubcommand(subcommand =>
      subcommand
        .setName("search")
        .setDescription("Search for an anime")
        .addStringOption(option =>
          option.setName("name").setDescription("Search for an anime by name").setAutocomplete(true).setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("user")
        .setDescription("Get information about a user on AniList")
        .addStringOption(option =>
          option.setName("anilist-user").setDescription("Get a user by their AniList username").setRequired(false),
        )
        .addUserOption(option =>
          option
            .setName("discord-user")
            .setDescription("Get an AniList user from a connected Discord user")
            .setRequired(false),
        ),
    ),
  isUserCommand: true,
  async autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    const commandPath = `./${subcommand}`;
    const commandModule = await import(commandPath);
    const autocomplete = commandModule.autocomplete;

    autocomplete(interaction, client);
  },
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    const commandPath = `./${subcommand}`;
    const commandModule = await import(commandPath);
    const execute = commandModule.default;

    execute(interaction, client);
  },
};
