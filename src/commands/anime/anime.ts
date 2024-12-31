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
          option
            .setName("name")
            .setDescription("Search for an anime by name")
            .setAutocomplete(true)
            .setRequired(true)
            .setMaxLength(150),
        ),
    )
    .addSubcommandGroup(group =>
      group
        .setName("user")
        .setDescription("User related commands")
        .addSubcommand(subcommand =>
          subcommand
            .setName("anilist")
            .setDescription("Get information about a user on AniList")
            .addStringOption(option =>
              option
                .setName("username")
                .setDescription("Get a user by their AniList username")
                .setRequired(true)
                .setAutocomplete(true)
                .setMaxLength(100),
            ),
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("discord")
            .setDescription("Get an AniList user information for a connected Discord user")
            .addUserOption(option =>
              option
                .setName("user")
                .setDescription("Get an AniList user information for a connected Discord user")
                .setRequired(true),
            ),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand.setName("connect").setDescription("Connect your AniList account to Schnoobot"),
    ),
  isUserCommand: true,
  async autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    const commandPath = subcommandGroup ? `./${subcommandGroup}/${subcommand}` : `./${subcommand}`;
    const commandModule = await import(commandPath);
    const autocomplete = commandModule.autocomplete;

    autocomplete(interaction, client);
  },
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    const commandPath = subcommandGroup ? `./${subcommandGroup}/${subcommand}` : `./${subcommand}`;
    const commandModule = await import(commandPath);
    const execute = commandModule.default;

    execute(interaction, client);
  },
};
