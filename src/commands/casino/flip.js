const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, bold } = require("discord.js");
const { getNumber, validateAmount } = require("../../EconomyManager");

function constructComponents(options) {
  const { selected = null, win } = options;

  const playAgainButton = new ButtonBuilder()
    .setCustomId("playAgain")
    .setLabel("Play again")
    .setStyle(ButtonStyle.Primary);

  const doubleButton = new ButtonBuilder()
    .setCustomId("double")
    .setLabel("Play again (2x wager)")
    .setStyle(ButtonStyle.Danger);

  switch (selected) {
    case "playAgain":
      playAgainButton.setStyle(ButtonStyle.Success).setDisabled(true);
      doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "double":
      doubleButton.setStyle(ButtonStyle.Success).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "none":
      doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
  }

  const row = new ActionRowBuilder().addComponents(playAgainButton);

  if (!win) row.addComponents(doubleButton);

  return [row];
}

function constructEmbed(choice, result, wager, balance) {
  const win = result === choice;
  const description = `${bold(`You ${win ? "won" : "lost"}!`)} The coin landed on ${bold(result)}.`;
  const netGain = win ? wager : -wager;
  const color = win ? "Green" : "Red";

  const embed = new EmbedBuilder()
    .setTitle("🪙 Coin Flip")
    .setDescription(description)
    .setColor(color)
    .addFields(
      { name: bold("Net Gain"), value: getNumber(netGain).formatted, inline: true },
      { name: bold("Balance"), value: getNumber(balance).formatted, inline: true },
    );

  return embed;
}

function flipCoin() {
  return ["heads", "tails"][Math.floor(Math.random() * 2)];
}

module.exports = async (interaction, wager = null, choice = null) => {
  wager ??= interaction.options.getString("wager");
  choice ??= interaction.options.getString("choice");

  let balance = interaction.client.economy.getBalance(interaction.user.id);

  let { value: wagerValue } = getNumber(wager, balance);

  const error = validateAmount(wagerValue, balance);
  if (error instanceof Error) {
    return interaction.reply({ content: bold(error.message), ephemeral: true });
  }

  const result = flipCoin();

  const win = result === choice;
  const netGain = win ? wagerValue : -wagerValue;
  balance += netGain;

  interaction.client.economy.addBalance(interaction.user.id, netGain);

  const embed = constructEmbed(choice, result, wagerValue, balance);

  const reply = await interaction.reply({
    embeds: [embed],
    components: constructComponents({ win }),
    fetchReply: true,
  });

  const filter = i => i.user.id === interaction.user.id;

  const i = await reply.awaitMessageComponent({ filter, time: 15_000 }).catch(() => null);

  let selected = "none";

  if (i) {
    selected = i.customId;

    if (i.customId === "double") wagerValue *= 2;

    module.exports(i, wagerValue, choice);
  }

  reply.edit({ components: constructComponents({ selected, win }) });
};
