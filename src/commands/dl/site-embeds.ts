import { ColorResolvable, EmbedBuilder, hyperlink } from "discord.js";
import { Payload } from "youtube-dl-exec";
import numeral from "numeral";

interface EmbedStrategy {
  (jsonDump: Payload): EmbedBuilder;
}

const embedStrategies: Record<string, EmbedStrategy> = {
  tiktok: (jsonDump: Payload) => {
    return createEmbed(`TikTok @${jsonDump.uploader}`, jsonDump.webpage_url, "#040404", getDetails(jsonDump));
  },
  reddit: (jsonDump: Payload) => {
    const details = getDetails(jsonDump, "", "⬆️", "💬", "");
    return createEmbed(
      `r/${jsonDump.channel_id} u/${jsonDump.uploader}`,
      jsonDump.webpage_url,
      "#FF4500",
      [jsonDump.title, details].join(" "),
    );
  },
  youtube: (jsonDump: Payload) => {
    return createEmbed(
      `YouTube - ${jsonDump.channel}`,
      jsonDump.webpage_url,
      "#FF0000",
      [jsonDump.title, getDetails(jsonDump)].join(" "),
    );
  },
  twitter: (jsonDump: Payload) => {
    return createEmbed(`Twitter @${jsonDump.uploader_id}`, jsonDump.webpage_url, "#1DA1F2", getDetails(jsonDump));
  },
  instagram: (jsonDump: Payload) => {
    return createEmbed(`Instagram @${jsonDump.channel}`, jsonDump.webpage_url, "#E1306C", getDetails(jsonDump));
  },
  default: (jsonDump: Payload) => {
    let title = jsonDump.extractor;

    if (["generic", "html5"].includes(title) && jsonDump.webpage_url_domain) {
      title += jsonDump.webpage_url_domain;
    }

    if (jsonDump.uploader) {
      title += ` @${jsonDump.uploader}`;
    } else if (jsonDump.channel) {
      title += ` @${jsonDump.channel}`;
    }

    return createEmbed(title.trim(), jsonDump.webpage_url, null, getDetails(jsonDump));
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

  if (jsonDump.view_count ?? false) {
    details += `${viewEmoji} ${format(jsonDump.view_count)} `;
  }
  if (jsonDump.like_count ?? false) {
    details += `${likeEmoji} ${format(jsonDump.like_count)} `;
  }
  if (jsonDump.comment_count ?? false) {
    details += `${commentEmoji} ${format(jsonDump.comment_count)} `;
  }
  if (jsonDump.repost_count ?? false) {
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
  return new EmbedBuilder().setDescription(hyperlink(label, url)).setColor(color).setFooter({ text: secondaryLabel });
}

export function getEmbed(jsonDump: Payload): EmbedBuilder {
  const embedStrategy = embedStrategies[jsonDump.extractor.toLowerCase()] ?? embedStrategies["default"];
  return embedStrategy(jsonDump);
}
