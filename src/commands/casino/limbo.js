const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, bold } = require("discord.js");
const { getNumber, validateAmount } = require("../../EconomyManager");
const numeral = require("numeral");

function constructComponents(selected = null) {
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

  const row = new ActionRowBuilder().addComponents(playAgainButton, doubleButton);

  return [row];
}

function constructEmbed(targetMultiplier, resultMultiplier, wager, balance) {
  const win = targetMultiplier <= resultMultiplier;

  const targetMultiplierFormatted = numeral(targetMultiplier).format("0.00") + "x";
  const resultMultiplierFormatted = numeral(resultMultiplier).format("0.00") + "x";
  const winChance = 1 / targetMultiplier;
  const winChanceFormatted = numeral(winChance).format("0.00%");

  const description = `${bold(`You ${win ? "won" : "lost"}!`)} The multiplier was ${bold(resultMultiplierFormatted)}.`;
  const netGain = win ? wager * (targetMultiplier - 1) : -wager;
  const color = win ? "Green" : "Red";

  const embed = new EmbedBuilder()
    .setTitle("🚀 Limbo")
    .setDescription(description)
    .setColor(color)
    .addFields(
      { name: bold("Wager"), value: getNumber(wager).formatted, inline: true },
      { name: bold("Target Multiplier"), value: targetMultiplierFormatted, inline: true },
      { name: bold("Win Chance"), value: winChanceFormatted, inline: true },
      { name: bold("Net Gain"), value: getNumber(netGain).formatted, inline: true },
      { name: bold("Balance"), value: getNumber(balance).formatted, inline: true },
    );

  return embed;
}

function getLimboResult() {
  const result = 1 / Math.random();

  // truncate to 2 decimal places
  return Math.floor(result * 100) / 100;
}

module.exports = async (interaction, wager = null, targetMultiplier = null) => {
  wager ??= interaction.options.getString("wager");
  targetMultiplier ??= interaction.options.getNumber("target");

  let balance = interaction.client.economy.getBalance(interaction.user.id);

  let { value: wagerValue } = getNumber(wager, interaction.user.id);

  const error = validateAmount(wagerValue, balance);
  if (error instanceof Error) {
    return interaction.reply({ content: bold(error.message), ephemeral: true });
  }

  const resultMultiplier = getLimboResult();

  const win = targetMultiplier <= resultMultiplier;
  const netGain = win ? wagerValue * (targetMultiplier - 1) : -wagerValue;
  balance += netGain;
  interaction.client.economy.addBalance(interaction.user.id, netGain);

  const embed = constructEmbed(targetMultiplier, resultMultiplier, wagerValue, balance);
  const reply = await interaction.reply({ embeds: [embed], components: constructComponents(), fetchReply: true });

  const filter = i => i.user.id === interaction.user.id;
  const i = await reply.awaitMessageComponent({ filter, time: 15_000 }).catch(() => null);

  let selected = "none";

  if (i) {
    selected = i.customId;

    if (i.customId === "double") wagerValue *= 2;

    module.exports(i, wagerValue, targetMultiplier);
  }

  reply.edit({ components: constructComponents(selected) });
};
