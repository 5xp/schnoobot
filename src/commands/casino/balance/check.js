const { EmbedBuilder, bold } = require("discord.js");
const Currency = require("../../../libs/Currency");

module.exports = async interaction => {
  const user = interaction.options.getUser("user") ?? interaction.user;

  const balance = interaction.client.economy.getBalance(user.id);

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${user.username}'s Balance`, iconURL: user.avatarURL() })
    .setColor("Blurple")
    .addFields({ name: bold("Balance"), value: Currency.format(balance), inline: true });

  return interaction.reply({ embeds: [embed] });
};
