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
    .addSubcommand(subcommand =>
      subcommand
        .setName("user")
        .setDescription("Get information about an AniList user")
        .addStringOption(option =>
          option
            .setName("username")
            .setDescription("Get information about an AniList user")
            .setRequired(false)
            .setAutocomplete(true),
        )
        .addUserOption(option =>
          option
            .setName("discord-user")
            .setDescription("Get information about an AniList user connected to Schnoobot")
            .setRequired(false),
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
