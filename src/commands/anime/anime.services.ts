import { truncateString } from "@common/reply-utils";
import { EmbedBuilder } from "discord.js";
import NodeCache from "node-cache";
import {
  Anime,
  animeApiResponseSchema,
  MediaFormat,
  SearchResult,
  searchResultApiResponseSchema,
} from "./anime.schema";

const searchCache = new NodeCache({ stdTTL: 60 * 60 * 12, checkperiod: 60 * 60 });
const animeCache = new NodeCache({ stdTTL: 60 * 60 * 12, checkperiod: 60 * 60 });

export async function searchAnime(query: string): Promise<SearchResult[]> {
  const cached = searchCache.get<SearchResult[]>(query);

  if (cached) {
    return cached;
  }

  const apiQuery = `
  query ($search: String!, $perPage: Int) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME) {
        id
        title {
          romaji
          native
          english
        }
        meanScore
        isAdult
        format
      }
    }
  }`;

  const variables = {
    search: query,
    perPage: 8,
  };

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: apiQuery,
      variables,
    }),
  });

  const json = await response.json();
  const parseResult = searchResultApiResponseSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(JSON.stringify(json, null, 2));
    console.error(parseResult.error);
    return [];
  }

  const results = parseResult.data.data.Page.media;

  searchCache.set(query, results);

  return results;
}

export async function getAnime(id?: number, query?: string): Promise<Anime | null> {
  if (!id && !query) {
    return null;
  }

  if (id && animeCache.has(id)) {
    return animeCache.get<Anime>(id) ?? null;
  }

  const apiQuery = `
  query($mediaId: Int, $search: String)  {
    Media(id: $mediaId, search: $search) {
      id
      title {
        romaji
        native
        english
      }
      meanScore
      coverImage {
        color
        extraLarge
      }
      isAdult
      format
      description
      status
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      episodes
      bannerImage
      genres
    }
  }`;

  const variables = {
    mediaId: id,
    search: query,
  };

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: apiQuery,
      variables,
    }),
  });

  const json = await response.json();

  const parseResult = animeApiResponseSchema.safeParse(json);
  if (!parseResult.success) {
    console.error(JSON.stringify(json, null, 2));
    console.error(parseResult.error);
    return null;
  }

  const result = parseResult.data.data.Media;

  animeCache.set(result.id, result);

  return result;
}

function formatDate(date: { year: number | null; month: number | null; day: number | null }): string | null {
  if (!date.year && !date.month && !date.day) {
    return null;
  }

  return `${date.month ?? "??"}/${date.day ?? "??"}/${date.year ?? "????"}`;
}

export function getAnimeEmbed(anime: Anime): EmbedBuilder {
  const joinWithSeparator = (parts: (string | null)[], separator = " • ") => parts.filter(Boolean).join(separator);

  const titleParts = [
    anime.format ? formatEmojiMap[anime.format] : null,
    getTitle(anime.title),
    anime.isAdult ? "🔞" : null,
  ];
  const title = joinWithSeparator(titleParts, " ");

  const descriptionParts: string[] = [];

  if (anime.format || anime.genres.length) {
    const meta = joinWithSeparator([
      anime.format ? formatNameMap[anime.format] : null,
      anime.genres.length ? anime.genres.join(", ") : null,
    ]);
    if (meta) descriptionParts.push(`-# ${meta}`);
  }

  if (anime.description) {
    descriptionParts.push(fixHTML(removeHTML(anime.description)));
  }

  if (anime.episodes) {
    descriptionParts.push(`-# ${anime.episodes} episode${anime.episodes > 1 ? "s" : ""}`);
  }

  const description = truncateString(descriptionParts.join("\n\n").trim(), 4096);

  const dateParts = joinWithSeparator(
    [
      formatDate(anime.startDate),
      anime.endDate && anime.endDate !== anime.startDate ? formatDate(anime.endDate) : null,
    ],
    " - ",
  );

  const footerParts = [
    `${statusEmojiMap[anime.status]} ${statusNameMap[anime.status]}`,
    dateParts,
    anime.meanScore ? `⭐${anime.meanScore}/100` : null,
  ];
  const footer = joinWithSeparator(footerParts);

  return new EmbedBuilder()
    .setTitle(title)
    .setURL(`https://anilist.co/anime/${anime.id}`)
    .setDescription(description)
    .setColor(anime.coverImage.color as `#${string}`)
    .setImage(anime.coverImage.extraLarge)
    .setFooter({ text: footer })
    .setThumbnail(anime.bannerImage);
}

export function getTitle(title: { romaji: string | null; native: string | null; english: string | null }): string {
  return title.english ?? title.romaji ?? title.native ?? "Unknown";
}

export const formatEmojiMap: Record<MediaFormat, string> = {
  TV: "📺",
  TV_SHORT: "📺",
  MOVIE: "🎥",
  SPECIAL: "🎥",
  OVA: "📀",
  ONA: "📱",
  MUSIC: "🎵",
  MANGA: "📖",
  NOVEL: "📚",
  ONE_SHOT: "📚",
};

export const formatNameMap: Record<MediaFormat, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
  MANGA: "Manga",
  NOVEL: "Novel",
  ONE_SHOT: "One Shot",
};

export const statusEmojiMap: Record<string, string> = {
  FINISHED: "✅",
  RELEASING: "📅",
  NOT_YET_RELEASED: "🔜",
  CANCELLED: "❌",
  HIATUS: "⏸️",
};

export const statusNameMap: Record<string, string> = {
  FINISHED: "Finished Airing",
  RELEASING: "Releasing",
  NOT_YET_RELEASED: "Not Yet Released",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
};

function removeHTML(text: string): string {
  return text
    .replace(/<\s*br.*?>/g, "")
    .replace(/<i>(.*?)<\/i>/g, "*$1*")
    .replace(/<b>(.*?)<\/b>/g, "**$1**")
    .replace(/<s>(.*?)<\/s>/g, "~~$1~~")
    .replace(/<(.*?)>/g, "");
}

function fixHTML(text: string): string {
  return text.replace(/&#?(?<identifier>[a-z0-9]+);/g, (...params) => {
    const { identifier } = params.pop();
    return htmlEntities[identifier] || String.fromCharCode(Number(identifier));
  });
}

const htmlEntities: Record<string, string> = {
  nbsp: " ",
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
  cent: "¢",
  pound: "£",
  yen: "¥",
  euro: "€",
  copy: "©",
  reg: "®",
};
