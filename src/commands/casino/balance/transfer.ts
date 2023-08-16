import { ChatInputCommandInteraction, EmbedBuilder, bold } from "discord.js";
import Currency from "@common/Currency";
import ExtendedClient from "@common/ExtendedClient";

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const amountString = interaction.options.getString("amount", true);
  const recipient = interaction.options.getUser("recipient", true);

  const balance = client.economy.getBalance(interaction.user.id);
  const amount = new Currency(amountString, balance);

  if (amount.validity.code !== "valid") {
    interaction.reply({ content: bold(amount.validity.message), ephemeral: true });
    return;
  }

  const { userBalance, recipientBalance } = await client.economy.transferBalance(
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

  interaction.reply({ embeds: [embed] });
}
