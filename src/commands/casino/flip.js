const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, bold } = require("discord.js");
const { getNumber, validateAmount } = require("../../libs/EconomyManager");

function constructComponents(options) {
  const { selected = null, wager, originalWager } = options;

  const playAgainButton = new ButtonBuilder()
    .setCustomId("playAgain")
    .setLabel("Play again")
    .setStyle(ButtonStyle.Primary);

  const doubleButton = new ButtonBuilder()
    .setCustomId("double")
    .setLabel("Play again (2x wager)")
    .setStyle(ButtonStyle.Danger);

  const originalWagerButton = new ButtonBuilder()
    .setCustomId("originalWager")
    .setLabel(`Play again (${getNumber(originalWager).formatted})`)
    .setStyle(ButtonStyle.Secondary);

  switch (selected) {
    case "playAgain":
      playAgainButton.setStyle(ButtonStyle.Success).setDisabled(true);
      doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "double":
      doubleButton.setStyle(ButtonStyle.Success).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "originalWager":
      originalWagerButton.setStyle(ButtonStyle.Success).setDisabled(true);
      doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "none":
      doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
  }

  const row = new ActionRowBuilder().addComponents(playAgainButton, doubleButton);

  if (wager !== originalWager) row.addComponents(originalWagerButton);

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

module.exports = async (interaction, wager = null, choice = null, originalWager = null) => {
  wager ??= interaction.options.getString("wager");
  choice ??= interaction.options.getString("choice");

  let balance = interaction.client.economy.getBalance(interaction.user.id);

  const { value: wagerValue } = getNumber(wager, balance);
  originalWager ??= wagerValue;

  const error = validateAmount(wagerValue, balance);
  if (error instanceof Error) {
    return interaction.reply({ content: bold(error.message), ephemeral: true });
  }

  const result = flipCoin();

  const win = result === choice;
  const netGain = win ? wagerValue : -wagerValue;
  balance += netGain;

  interaction.client.economy.addBalance(interaction.user.id, netGain);
  interaction.client.economy.addLog(interaction.user.id, "flip", netGain);

  const embed = constructEmbed(choice, result, wagerValue, balance);

  const reply = await interaction.reply({
    embeds: [embed],
    components: constructComponents({ wager: wagerValue, originalWager }),
  });

  const filter = i => i.user.id === interaction.user.id;

  const i = await reply.awaitMessageComponent({ filter, time: 15_000 }).catch(() => null);

  let selected = "none";

  if (i) {
    selected = i.customId;

    let newWager = wagerValue;

    if (i.customId === "double") newWager *= 2;
    if (i.customId === "originalWager") newWager = originalWager;

    module.exports(i, newWager, choice, originalWager);
  }

  interaction.editReply({
    components: constructComponents({
      selected,
      wager: wagerValue,
      originalWager,
    }),
  });
};
