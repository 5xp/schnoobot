const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, bold, ComponentType } = require("discord.js");
const Currency = require("../../libs/Currency");
const numeral = require("numeral");

function constructActionRow(options) {
  const { selected = null, multiplier = 0, win, wager, originalWager, balance } = options;

  const playAgainButton = new ButtonBuilder()
    .setCustomId("playAgain")
    .setLabel("Play again" + (wager.allIn ? " (all in)" : ""))
    .setStyle(ButtonStyle.Primary);

  const multiplierButton = new ButtonBuilder()
    .setCustomId("multiplier")
    .setLabel(`Play again (${multiplier.toFixed(2)}x wager)`)
    .setStyle(ButtonStyle.Danger);

  const originalWagerButton = new ButtonBuilder()
    .setCustomId("originalWager")
    .setLabel(`Play again (${originalWager.formatted})`)
    .setStyle(ButtonStyle.Secondary);

  switch (selected) {
    case "playAgain":
      playAgainButton.setStyle(ButtonStyle.Success).setDisabled(true);
      multiplierButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "multiplier":
      multiplierButton.setStyle(ButtonStyle.Success).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "originalWager":
      originalWagerButton.setStyle(ButtonStyle.Success).setDisabled(true);
      multiplierButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
    case "none":
      multiplierButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
      break;
  }

  if (wager.value > balance) playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
  if (wager.value * multiplier > balance) multiplierButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
  if (originalWager.value > balance) originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);

  const row = new ActionRowBuilder().addComponents(playAgainButton);

  if (!win) row.addComponents(multiplierButton);

  if (!wager.isEqual(originalWager) || wager.allIn) row.addComponents(originalWagerButton);

  return [row];
}

function constructEmbed(options) {
  const { user, targetMultiplier, resultMultiplier, wager, balance } = options;
  const win = targetMultiplier <= resultMultiplier;

  const targetMultiplierFormatted = targetMultiplier.toFixed(2) + "x";
  const resultMultiplierFormatted = resultMultiplier.toFixed(2) + "x";

  const winChance = 1 / targetMultiplier;
  const winChanceFormatted = numeral(winChance).format("0.00%");

  const description = `${bold(`You ${win ? "won" : "lost"}!`)} The multiplier was ${bold(resultMultiplierFormatted)}.`;
  const netGain = win ? wager.value * (targetMultiplier - 1) : -wager.value;
  const color = win ? "Green" : "Red";

  const embed = new EmbedBuilder()
    .setTitle("🚀 Limbo")
    .setDescription(description)
    .setColor(color)
    .addFields(
      { name: bold("Wager"), value: wager.formatted, inline: true },
      { name: bold("Target Multiplier"), value: targetMultiplierFormatted, inline: true },
      { name: bold("Win Chance"), value: winChanceFormatted, inline: true },
      { name: bold("Net Gain"), value: Currency.format(netGain), inline: true },
      { name: bold("Balance"), value: Currency.format(balance), inline: true },
    )
    .setFooter({ text: user.username, iconURL: user.avatarURL() });

  return embed;
}

function getLimboResult() {
  const result = 1 / Math.random();

  // truncate to 2 decimal places
  return Math.floor(result * 100) / 100;
}

module.exports = async (interaction, targetMultiplier = null, wager = null, originalWager = null) => {
  wager ??= interaction.options.getString("wager");
  targetMultiplier ??= interaction.options.getNumber("target");

  let balance = interaction.client.economy.getBalance(interaction.user.id);
  wager = new Currency(wager, balance);
  originalWager ??= wager;

  if (wager.validity.code !== "valid") {
    return interaction.reply({ content: bold(wager.validity.message), ephemeral: true });
  }

  const resultMultiplier = getLimboResult();
  const playAgainMultiplier = targetMultiplier / (targetMultiplier - 1);

  const win = targetMultiplier <= resultMultiplier;
  const netGain = win ? wager.value * (targetMultiplier - 1) : -wager.value;
  balance += netGain;

  interaction.client.economy.addBalance(interaction.user.id, netGain);
  interaction.client.economy.addLog(interaction.user.id, "limbo", netGain);

  const components = constructActionRow({ multiplier: playAgainMultiplier, win, wager, originalWager, balance });
  const embed = constructEmbed({ user: interaction.user, targetMultiplier, resultMultiplier, wager, balance });

  const response = await interaction.reply({ embeds: [embed], components, fetchReply: true });
  const filter = i => i.user.id === interaction.user.id;
  const componentInteraction = await response.awaitMessageComponent({ filter, time: 15_000 }).catch(() => null);

  let selected = "none";

  if (componentInteraction) {
    selected = componentInteraction.customId;

    let newWager = wager;

    if (selected === "multiplier") {
      newWager = new Currency(wager.value * playAgainMultiplier, balance);
    }

    if (selected === "originalWager") {
      newWager = new Currency(originalWager.value, balance);
      originalWager = newWager;
    }

    module.exports(componentInteraction, targetMultiplier, newWager, originalWager);
  }

  interaction.editReply({
    components: constructActionRow({
      multiplier: playAgainMultiplier,
      selected,
      win,
      wager,
      originalWager,
    }),
  });
};
