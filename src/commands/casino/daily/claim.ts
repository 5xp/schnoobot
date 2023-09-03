import Currency from "@common/Currency";
import { StreakRewardResponse } from "@common/EconomyManager";
import ExtendedClient from "@common/ExtendedClient";
import { ChatInputCommandInteraction, EmbedBuilder, EmbedField, bold, time } from "discord.js";
const formatter = new Intl.RelativeTimeFormat("en", { style: "short" });

type TimeUnit = "month" | "week" | "day" | "hour" | "minute" | "second";

type TimeUnitPair = {
  value: number;
  unit: TimeUnit;
};

function largestTimeUnit(seconds: number): TimeUnitPair {
  let value: number, unit: TimeUnit;
  if (seconds < 60) {
    value = seconds;
    unit = "second";
  } else if (seconds < 3600) {
    value = seconds / 60;
    unit = "minute";
  } else if (seconds < 86400) {
    value = seconds / 3600;
    unit = "hour";
  } else if (seconds < 604800) {
    value = seconds / 86400;
    unit = "day";
  } else if (seconds < 2629743) {
    value = seconds / 604800;
    unit = "week";
  } else {
    value = seconds / 2629743;
    unit = "month";
  }

  const valueRounded = Math.round(value * 10) / 10;

  return { value: valueRounded, unit };
}

function getRelativeTime(seconds: number) {
  const { value, unit } = largestTimeUnit(seconds);
  let formattedString = formatter.format(value, unit);
  formattedString = formattedString.replace(/(ago|in)/, "").trim();

  return formattedString;
}

function constructEmbed(response: StreakRewardResponse): EmbedBuilder {
  const embed = new EmbedBuilder();

  const fields: Array<EmbedField> = [
    {
      name: bold("Balance"),
      value: Currency.format(response.balance),
      inline: true,
    },
    {
      name: bold("Streak"),
      value: `${response.streak} 🔥`,
      inline: true,
    },
  ];

  if (response.status === "unavailable") {
    embed.setTitle("🚫 Daily Reward").setColor("Red").setDescription("You have already claimed your daily reward!");
    const availableAtSeconds = Math.floor(response.availableAt / 1000);
    const availableAtString = `${time(availableAtSeconds, "R")}\n(${time(availableAtSeconds, "t")})`;

    fields.unshift({ name: "Available", value: availableAtString, inline: true });
  } else if (response.status === "late") {
    const lateBySeconds = Math.floor(response.lateBy / 1000);
    const lateBy = getRelativeTime(lateBySeconds);

    embed
      .setTitle("💔 Daily Reward")
      .setColor("Orange")
      .setDescription(`You were late by ${bold(lateBy)}!`);

    fields.unshift({ name: "Reward", value: Currency.format(response.reward), inline: true });
  } else {
    embed.setTitle("🎉 Daily Reward").setColor("Green");

    const almostLateBySeconds = Math.abs(Math.floor(response.almostLateBy / 1000));
    const almostLateSecondsThreshold = 60 * 30;

    if (response.almostLateBy > 0 && almostLateBySeconds <= almostLateSecondsThreshold) {
      const almostLateBy = getRelativeTime(almostLateBySeconds);
      embed.setDescription(`You almost missed your daily by ${bold(almostLateBy)}!`);
    }

    fields.unshift({ name: "Reward", value: Currency.format(response.reward), inline: true });
  }

  embed.addFields(...fields);

  return embed;
}

export default async (interaction: ChatInputCommandInteraction, client: ExtendedClient) => {
  const response = await client.economy.rewardStreak(interaction.user.id);
  const embed = constructEmbed(response);

  return interaction.reply({ embeds: [embed] });
};
