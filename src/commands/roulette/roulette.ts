import ExtendedClient from "@common/ExtendedClient";
import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("Get a random post from a social media platform or forum")
    .addSubcommand(subcommand =>
      subcommand
        .setName("4chan")
        .setDescription("Get a random post from a 4chan board")
        .addStringOption(option =>
          option
            .setName("board")
            .setDescription("The board to get a post from")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption(option =>
          option
            .setName("thread-title")
            .setDescription("Filters threads that contain the given title")
            .setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName("thread-subtitle")
            .setDescription("Filters threads that contain the given subtitle")
            .setRequired(false),
        )
        .addIntegerOption(option =>
          option
            .setName("thread-no")
            .setDescription("The thread number to get. Ignores previous filters.")
            .setRequired(false),
        )
        .addBooleanOption(option =>
          option
            .setName("exclude-text")
            .setDescription("Exclude posts that contain only text. Defaults to true.")
            .setRequired(false),
        )
        .addBooleanOption(option =>
          option.setName("videos-only").setDescription("Get posts that only have videos").setRequired(false),
        ),
    ),
  // .addSubcommand(subcommand =>
  //   subcommand
  //     .setName("reddit")
  //     .setDescription("Get a random post from a subreddit or user")
  //     .addStringOption(option =>
  //       option
  //         .setName("query")
  //         .setDescription("The subreddit or user to get a post from. If a user, format your query as u/username")
  //         .setRequired(true),
  //     )
  //     .addStringOption(option =>
  //       option
  //         .setName("timeframe")
  //         .setDescription("The timeframe to get the post from")
  //         .addChoices(
  //           { name: "All", value: "all" },
  //           { name: "Year", value: "year" },
  //           { name: "Month", value: "month" },
  //           { name: "Week", value: "week" },
  //           { name: "Day", value: "day" },
  //         )
  //         .setRequired(false),
  //     )
  //     .addBooleanOption(option =>
  //       option.setName("exclude-text").setDescription("Exclude text posts").setRequired(false),
  //     ),
  // )
  // .addSubcommand(subcommand =>
  //   subcommand
  //     .setName("twitter")
  //     .setDescription("Get a random tweet from a user")
  //     .addStringOption(option =>
  //       option.setName("user").setDescription("The user to get a tweet from").setRequired(true),
  //     )
  //     .addBooleanOption(option =>
  //       option.setName("media-only").setDescription("Only include tweets with media").setRequired(false),
  //     ),
  // )
  // .addSubcommand(subcommand =>
  //   subcommand
  //     .setName("tiktok")
  //     .setDescription("Get a random TikTok video from a user")
  //     .addStringOption(option =>
  //       option.setName("user").setDescription("The user to get a video from").setRequired(true),
  //     ),
  // )
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
