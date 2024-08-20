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
          option.setName("thread").setDescription("Search for a thread").setAutocomplete(true).setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName("type")
            .setDescription("The type of post to get. Defaults to images + videos")
            .addChoices(
              { name: "All", value: "all" },
              { name: "Images + Videos", value: "image" },
              { name: "Videos", value: "video" },
            )
            .setRequired(false),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("reddit")
        .setDescription("Get a random post from a subreddit or user")
        .addStringOption(option =>
          option
            .setName("query")
            .setDescription(
              "Fetch a random post. Supports subreddits, users, & multi-reddits. Ex: 'memes u/user u/user/m/multi'",
            )
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName("sort")
            .setDescription("The sorting to use")
            .addChoices(
              { name: "Hot (Default)", value: "hot" },
              { name: "Top (All Time)", value: "top" },
              { name: "Top (Year)", value: "top-year" },
              { name: "Top (Month)", value: "top-month" },
            )
            .setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName("type")
            .setDescription("The type of post to get")
            .addChoices(
              { name: "All", value: "all" },
              { name: "Images + Videos (Default)", value: "media" },
              { name: "Images", value: "image" },
              { name: "Videos", value: "video" },
            )
            .setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName("nsfw")
            .setDescription("If the channel is marked as NSFW, optionally include NSFW posts")
            .addChoices(
              { name: "All (Default)", value: "all" },
              { name: "None", value: "none" },
              { name: "Only", value: "only" },
            ),
        ),
    ),
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

    console.log(`Executing ${subcommand} command`);

    execute(interaction, client);
  },
};
