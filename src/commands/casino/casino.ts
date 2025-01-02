import ExtendedClient from "@common/ExtendedClient";
import {
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setDescription("casino commands")
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName("balance")
        .setDescription("Check, add, or set your balance")
        .addSubcommand(subcommand =>
          subcommand
            .setName("check")
            .setDescription("Check your or another user's balance")
            .addUserOption(option => option.setName("user").setDescription("The user to check").setRequired(false)),
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName("transfer")
            .setDescription("Transfer balance to another person")
            .addStringOption(option =>
              option.setName("amount").setDescription("The amount to transfer").setRequired(true),
            )
            .addUserOption(option =>
              option.setName("recipient").setDescription("The user to transfer to").setRequired(true),
            ),
        ),
    )
    .addSubcommandGroup(subcommandGroup =>
      subcommandGroup
        .setName("daily")
        .setDescription("Claim your daily reward")
        .addSubcommand(subcommand => subcommand.setName("claim").setDescription("Claim your daily reward")),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("flip")
        .setDescription("Flip a coin")
        .addStringOption(option =>
          option
            .setName("choice")
            .setDescription("Heads or tails")
            .setRequired(true)
            .addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" }),
        )
        .addStringOption(option => option.setName("wager").setDescription("The amount to wager").setRequired(true)),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("limbo")
        .setDescription("Pick a target multiplier. If it lands higher than the target, you win.")
        .addNumberOption(option =>
          option.setName("target").setDescription("The target multiplier").setRequired(true).setMinValue(1),
        )
        .addStringOption(option =>
          option.setName("wager").setDescription("The amount of money to wager").setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("mines")
        .setDescription("Choose how many mines you want. If you hit a mine, you lose.")
        .addNumberOption(option =>
          option
            .setName("mines")
            .setDescription("The number of mines to choose")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(24),
        )
        .addStringOption(option =>
          option.setName("wager").setDescription("The amount of money to wager").setRequired(true),
        ),
    )
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall])
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]),
  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    const commandPath = subcommandGroup ? `./${subcommandGroup}/${subcommand}` : `./${subcommand}`;
    const commandModule = await import(commandPath);
    const execute = commandModule.default;

    execute(interaction, client);
  },
};
