const { EmbedBuilder, time, bold } = require("discord.js");
const Currency = require("../../../libs/Currency");
const formatter = new Intl.RelativeTimeFormat("en", { style: "short" });

function largestTimeUnit(seconds) {
  let value, unit;
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

function getRelativeTime(seconds) {
  const { value, unit } = largestTimeUnit(seconds);
  let formattedString = formatter.format(value, unit);
  formattedString = formattedString.replace(/(ago|in)/, "").trim();

  return formattedString;
}

function constructEmbed(response) {
  const embed = new EmbedBuilder();

  const fields = [
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

  if (!response.success) {
    embed.setTitle("🚫 Daily Reward").setColor("Red").setDescription("You have already claimed your daily reward!");
    const availableAtSeconds = Math.floor(response.availableAt / 1000);
    const availableAtString = `${time(availableAtSeconds, "R")}\n(${time(availableAtSeconds, "t")})`;

    fields.unshift({ name: "Available", value: availableAtString, inline: true });
  } else if (response.late) {
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

    if (almostLateBySeconds <= almostLateSecondsThreshold) {
      const almostLateBy = getRelativeTime(almostLateBySeconds);
      embed.setDescription(`You almost missed your daily by ${bold(almostLateBy)}!`);
    }

    fields.unshift({ name: "Reward", value: Currency.format(response.reward), inline: true });
  }

  embed.addFields(...fields);

  return embed;
}

module.exports = async interaction => {
  const response = await interaction.client.economy.rewardStreak(interaction.user.id);
  const embed = constructEmbed(response);

  return interaction.reply({ embeds: [embed] });
};
