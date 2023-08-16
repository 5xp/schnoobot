import { ChatInputCommandInteraction, EmbedBuilder, bold } from "discord.js";
import Currency from "@common/Currency";
import ExtendedClient from "@common/ExtendedClient";

export default async (interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> => {
  const user = interaction.options.getUser("user") ?? interaction.user;

  const balance = client.economy.getBalance(user.id);

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${user.username}'s Balance`, iconURL: user.displayAvatarURL() })
    .setColor("Blurple")
    .addFields({ name: bold("Balance"), value: Currency.format(balance), inline: true });

  interaction.reply({ embeds: [embed] });
  return;
};
