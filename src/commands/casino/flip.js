const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, bold } = require("discord.js");
const Currency = require("../../libs/Currency");

function constructActionRow(options) {
  const { selected = null, wager, originalWager, balance } = options;

  const playAgainButton = new ButtonBuilder()
    .setCustomId("playAgain")
    .setLabel("Play again" + (wager.allIn ? " (all in)" : ""))
    .setStyle(ButtonStyle.Primary);

  const doubleButton = new ButtonBuilder()
    .setCustomId("double")
    .setLabel("Play again (2x wager)")
    .setStyle(ButtonStyle.Danger);

  const originalWagerButton = new ButtonBuilder()
    .setCustomId("originalWager")
    .setLabel(`Play again (${originalWager.formatted})`)
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

  if (wager.value > balance) playAgainButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
  if (wager.value * 2 > balance) doubleButton.setStyle(ButtonStyle.Secondary).setDisabled(true);
  if (originalWager.value > balance) originalWagerButton.setStyle(ButtonStyle.Secondary).setDisabled(true);

  const row = new ActionRowBuilder().addComponents(playAgainButton, doubleButton);

  if (!wager.isEqual(originalWager) || wager.allIn) row.addComponents(originalWagerButton);

  return [row];
}

function constructEmbed(options) {
  const { user, choice, result, netGain, balance } = options;
  const win = result === choice;
  const description = `${bold(`You ${win ? "won" : "lost"}!`)} The coin landed on ${bold(result)}.`;
  const color = win ? "Green" : "Red";

  const embed = new EmbedBuilder()
    .setTitle("🪙 Coin Flip")
    .setDescription(description)
    .setColor(color)
    .addFields(
      { name: bold("Net Gain"), value: Currency.format(netGain), inline: true },
      { name: bold("Balance"), value: Currency.format(balance), inline: true },
    )
    .setFooter({ text: user.username, iconURL: user.avatarURL() });

  return embed;
}

function flipCoin() {
  return ["heads", "tails"][Math.floor(Math.random() * 2)];
}

module.exports = async (interaction, choice = null, wager = null, originalWager = null) => {
  wager ??= interaction.options.getString("wager");
  choice ??= interaction.options.getString("choice");

  let balance = interaction.client.economy.getBalance(interaction.user.id);
  wager = new Currency(wager, balance);
  originalWager ??= wager;

  if (wager.validity.code !== "valid") {
    return interaction.reply({ content: bold(wager.validity.message), ephemeral: true });
  }

  const result = flipCoin();
  const win = result === choice;
  const netGain = win ? wager.value : -wager.value;
  balance += netGain;

  interaction.client.economy.addBalance(interaction.user.id, netGain);
  interaction.client.economy.addLog(interaction.user.id, "flip", netGain);

  const components = constructActionRow({ wager, originalWager, balance });
  const embed = constructEmbed({ user: interaction.user, choice, result, netGain, balance });

  const response = await interaction.reply({ embeds: [embed], components, fetchReply: true });
  const filter = i => i.user.id === interaction.user.id;
  const componentInteraction = await response.awaitMessageComponent({ filter, time: 15_000 }).catch(() => null);

  let selected = "none";

  if (componentInteraction) {
    selected = componentInteraction.customId;

    let newWager = wager;

    if (selected === "double") {
      newWager = new Currency(wager.value * 2, balance);
    }

    if (selected === "originalWager") {
      newWager = new Currency(originalWager.value, balance);
      originalWager = newWager;
    }
    module.exports(componentInteraction, choice, newWager, originalWager);
  }

  interaction.editReply({
    components: constructActionRow({ selected, wager, originalWager }),
  });
};
