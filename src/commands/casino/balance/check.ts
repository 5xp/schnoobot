import Currency from "@common/Currency";
import ExtendedClient from "@common/ExtendedClient";
import { getDailyAvailableAt, getUser } from "@db/services";
import { bold, ChatInputCommandInteraction, EmbedBuilder, time, TimestampStyles } from "discord.js";

export default async (interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> => {
  const user = interaction.options.getUser("user") ?? interaction.user;

  const dbUser = await getUser(user.id);

  const balance = dbUser?.balance ?? 0;
  const lastDaily = dbUser?.lastDaily ?? 0;

  const dailyAvailableAt = getDailyAvailableAt(lastDaily);
  const dailyAvailableAtSeconds = Math.floor(dailyAvailableAt / 1000);

  const isAvailable = Date.now() >= dailyAvailableAt;
  const availabilityString = `❌⏰${time(dailyAvailableAtSeconds, TimestampStyles.RelativeTime)} (${time(
    dailyAvailableAtSeconds,
    TimestampStyles.ShortTime,
  )})`;

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${user.displayName}'s Balance`, iconURL: user.displayAvatarURL() })
    .setColor("Blurple")
    .addFields(
      { name: bold("Balance"), value: Currency.format(balance), inline: true },
      {
        name: bold("Daily"),
        value: isAvailable ? "✅ Available" : availabilityString,
        inline: true,
      },
    );

  interaction.reply({ embeds: [embed] });
  return;
};
