const { EmbedBuilder, bold } = require("discord.js");
const Currency = require("../../../libs/Currency");

module.exports = async interaction => {
  const amountString = interaction.options.getString("amount");
  const balance = interaction.client.economy.getBalance(interaction.user.id);
  const amount = new Currency(amountString, balance);

  if (amount.validity.code !== "valid") {
    return interaction.reply({ content: bold(amount.validity.message), ephemeral: true });
  }

  const recipient = interaction.options.getUser("recipient");

  const { userBalance, recipientBalance } = await interaction.client.economy.transferBalance(
    interaction.user.id,
    amount.value,
    recipient.id,
  );

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username}'s transfer to ${recipient.username}`)
    .setColor("Blurple")
    .addFields(
      { name: bold("Transfer Amount"), value: amount.formatted, inline: true },
      { name: bold("New Balance"), value: Currency.format(userBalance), inline: true },
      { name: bold(`${recipient.username}'s Balance`), value: Currency.format(recipientBalance), inline: true },
    );

  return interaction.reply({ embeds: [embed] });
};
