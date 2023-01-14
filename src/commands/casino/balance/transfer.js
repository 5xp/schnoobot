const { EmbedBuilder, bold } = require("discord.js");
const { getNumber } = require("../../../EconomyManager");

module.exports = async interaction => {
  const amountString = interaction.options.getString("amount");
  const { formatted: formattedAmount, value: amount } = getNumber(amountString, interaction.user.id);

  if (!interaction.client.economy.validateAmount(interaction.user.id, amount)) {
    return interaction.reply({ content: "You don't have enough balance to transfer", ephemeral: true });
  }

  const recipient = interaction.options.getUser("recipient");

  const { userBalance, recipientBalance } = await interaction.client.economy.transferBalance(
    interaction.user.id,
    amount,
    recipient.id,
  );

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username}'s transfer to ${recipient.username}`)
    .setColor("Blurple")
    .addFields(
      { name: bold("Transfer Amount"), value: formattedAmount, inline: true },
      { name: bold("New Balance"), value: getNumber(userBalance).formatted, inline: true },
      { name: bold(`${recipient.username}'s Balance`), value: getNumber(recipientBalance).formatted, inline: true },
    );

  return interaction.reply({ embeds: [embed] });
};
