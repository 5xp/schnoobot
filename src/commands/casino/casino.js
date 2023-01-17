const { SlashCommandBuilder } = require("discord.js");

module.exports = {
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
    ),
  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    const commandPath = subcommandGroup ? `./${subcommandGroup}/${subcommand}` : `./${subcommand}`;

    require(commandPath)(interaction);
  },
};
