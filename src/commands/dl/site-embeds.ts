import { applicationEmojis } from "@common/ExtendedClient";
import { ColorResolvable, EmbedBuilder, hideLinkEmbed, hyperlink } from "discord.js";
import numeral from "numeral";
import { Payload } from "youtube-dl-exec";

interface MessageStrategy {
  (options: StrategyOptions): string;
}

// We only don't use emoji when replying to a message because emojis only seem to work in webhooks
type StrategyOptions = { jsonDump: Payload; useEmoji: boolean };

const messageStrategies: Record<string, MessageStrategy> = {
  tiktok: (options: StrategyOptions) => {
    const label = `${options.useEmoji ? applicationEmojis.get("tiktok") : "TikTok"} **\`@${
      options.jsonDump.uploader
    }\`**`;
    return createMessage(label, options.jsonDump.webpage_url, getDetails(options.jsonDump));
  },
  reddit: (options: StrategyOptions) => {
    const details = getDetails(options.jsonDump, "", "⬆️", "💬", "");
    const label = `${options.useEmoji ? applicationEmojis.get("reddit") : "Reddit"} r/${
      options.jsonDump.channel_id
    } **\`u/${options.jsonDump.uploader}\`**`;
    return createMessage(label, options.jsonDump.webpage_url, details);
  },
  youtube: (options: StrategyOptions) => {
    const label = `${options.useEmoji ? applicationEmojis.get("youtube") : "YouTube"} **\`${
      options.jsonDump.channel
    }\`**`;
    return createMessage(label, options.jsonDump.webpage_url, getDetails(options.jsonDump));
  },
  twitter: (options: StrategyOptions) => {
    const label = `${options.useEmoji ? applicationEmojis.get("twitter") : "Twitter"} **\`@${
      options.jsonDump.uploader_id
    }\`**`;
    return createMessage(label, options.jsonDump.webpage_url, getDetails(options.jsonDump));
  },
  instagram: (options: StrategyOptions) => {
    const label = `${options.useEmoji ? applicationEmojis.get("instagram") : "Instagram"} **\`@${
      options.jsonDump.channel
    }\`**`;
    return createMessage(label, options.jsonDump.webpage_url, getDetails(options.jsonDump));
  },
  default: (options: StrategyOptions) => {
    let title = options.jsonDump.extractor;

    if (["generic", "html5"].includes(title) && options.jsonDump.webpage_url_domain) {
      title = options.jsonDump.webpage_url_domain;
    }

    if (options.jsonDump.uploader) {
      title += ` @${options.jsonDump.uploader}`;
    } else if (options.jsonDump.channel) {
      title += ` @${options.jsonDump.channel}`;
    }

    return createMessage(title.trim(), options.jsonDump.webpage_url, getDetails(options.jsonDump));
  },
};

// Using any here because Payload is incorrectly typed (missing like_count and repost_count)
function getDetails(
  jsonDump: any,
  viewEmoji = "👁️",
  likeEmoji = "❤️",
  commentEmoji = "💬",
  repostEmoji = "🔁",
): string {
  let details = "";

  if (jsonDump.view_count) {
    details += `${viewEmoji} ${format(jsonDump.view_count)} `;
  }
  if (jsonDump.like_count) {
    details += `${likeEmoji} ${format(jsonDump.like_count)} `;
  }
  if (jsonDump.comment_count) {
    details += `${commentEmoji} ${format(jsonDump.comment_count)} `;
  }
  if (jsonDump.repost_count) {
    details += `${repostEmoji} ${format(jsonDump.repost_count)} `;
  }

  return details.trim();
}

function format(input: any): string {
  if (typeof input === "number" && input < 1000) {
    return input.toString();
  }

  return numeral(input).format("0,0.0a");
}

function createEmbed(label: string, url: string, color: ColorResolvable | null, secondaryLabel: string): EmbedBuilder {
  const embed = new EmbedBuilder().setDescription(hyperlink(label, url)).setColor(color);

  if (secondaryLabel) {
    embed.setFooter({ text: secondaryLabel });
  }

  return embed;
}

function createMessage(label: string, url: string, secondaryLabel: string): string {
  let message = `-# ${hyperlink(label, hideLinkEmbed(url))}`;

  if (secondaryLabel) {
    message += `\n-# ${secondaryLabel}`;
  }

  return message;
}

export function getMessage(options: StrategyOptions): string {
  const messageStrategy = messageStrategies[options.jsonDump.extractor.toLowerCase()] ?? messageStrategies["default"];
  return messageStrategy(options);
}
