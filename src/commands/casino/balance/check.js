const { EmbedBuilder, bold } = require("discord.js");
const { getNumber } = require("../../../libs/EconomyManager");

module.exports = async interaction => {
  const user = interaction.options.getUser("user") ?? interaction.user;

  const balance = interaction.client.economy.getBalance(user.id);
  const { formatted: formattedBalance } = getNumber(balance);

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${user.username}'s Balance`, iconURL: user.avatarURL() })
    .setColor("Blurple")
    .addFields({ name: bold("Balance"), value: formattedBalance, inline: true });

  return interaction.reply({ embeds: [embed] });
};
