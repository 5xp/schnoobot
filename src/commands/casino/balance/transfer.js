const { EmbedBuilder, bold } = require("discord.js");
const { getNumber, validateAmount } = require("../../../libs/EconomyManager");

module.exports = async interaction => {
  const amountString = interaction.options.getString("amount");
  const balance = interaction.client.economy.getBalance(interaction.user.id);
  const { formatted: formattedAmount, value: amount } = getNumber(amountString, balance);

  const error = validateAmount(amount, balance);
  if (error instanceof Error) {
    return interaction.reply({ content: bold(error.message), ephemeral: true });
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
