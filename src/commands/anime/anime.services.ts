import { truncateString } from "@common/reply-utils";
import { Colors, EmbedBuilder, hyperlink, time, User } from "discord.js";
import { ENV } from "env";
import jwt from "jsonwebtoken";
import NodeCache from "node-cache";
import {
  Anime,
  ListActivity,
  listActivityHistoryApiResponseSchema,
  animeApiResponseSchema,
  AnimeSearchResult,
  animeSearchResultApiResponseSchema,
  AnimeUser,
  animeUserApiResponseSchema,
  AnimeUserSearchResult,
  animeUserSearchResultApiResponseSchema,
  MediaFormat,
} from "./anime.schema";

const animeSearchCache = new NodeCache({ stdTTL: 60 * 60 * 12, checkperiod: 60 * 60 });
const animeCache = new NodeCache({ stdTTL: 60 * 60 * 12, checkperiod: 60 * 60 });
const animeUserSearchCache = new NodeCache({ stdTTL: 60 * 60 * 12, checkperiod: 60 * 60 });
const animeUserCache = new NodeCache({ stdTTL: 60 * 60 * 12, checkperiod: 60 * 60 });
const animeUserIdCache = new NodeCache({ stdTTL: 60 * 60 * 12, checkperiod: 60 * 60 });
const userLastActivityCache = new NodeCache({ stdTTL: 60, checkperiod: 60 });

export async function searchAnime(query: string, accessToken?: string): Promise<AnimeSearchResult[]> {
  const cached = animeSearchCache.get<AnimeSearchResult[]>(query);

  if (cached) {
    return cached;
  }

  const apiQuery = `
  query SearchAnime($search: String!, $perPage: Int) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME) {
        id
        title {
          romaji
          native
          english
          userPreferred
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

  const json = await queryAniList(apiQuery, variables, accessToken);

  const parseResult = animeSearchResultApiResponseSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(JSON.stringify(json, null, 2));
    console.error(parseResult.error);
    return [];
  }

  const results = parseResult.data.data.Page.media;

  animeSearchCache.set(query, results);

  return results;
}

export async function getAnime(id?: number, query?: string, accessToken?: string): Promise<Anime | null> {
  if (!id && !query) {
    return null;
  }

  if (id && animeCache.has(id)) {
    return animeCache.get<Anime>(id) ?? null;
  }

  if (id) {
    query = undefined;
  }

  const apiQuery = `
  query GetAnime($mediaId: Int, $search: String)  {
    Media(id: $mediaId, search: $search) {
      id
      title {
        romaji
        native
        english
        userPreferred
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

  const json = await queryAniList(apiQuery, variables, accessToken);

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

export async function searchUsers(query: string): Promise<AnimeUserSearchResult[]> {
  const cached = animeSearchCache.get<AnimeUserSearchResult[]>(query);

  if (cached) {
    return cached;
  }

  const apiQuery = `
  query SearchUsers($search: String!, $perPage: Int) {
    Page(perPage: $perPage) {
      users(search: $search) {
        id
        name
      }
    }
  }`;

  const variables = {
    search: query,
    perPage: 8,
  };

  const json = await queryAniList(apiQuery, variables);

  const parseResult = animeUserSearchResultApiResponseSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(JSON.stringify(json, null, 2));
    console.error(parseResult.error);
    return [];
  }

  const results = parseResult.data.data.Page.users;

  animeUserSearchCache.set(query, results);

  return results;
}

type AnimeUserSearchOptions = {
  id?: number;
  query?: string;
  accessToken?: string;
};
export async function getAnimeUser({ id, query, accessToken }: AnimeUserSearchOptions): Promise<AnimeUser | null> {
  if (!id && !query) {
    return null;
  }

  if (id && animeUserCache.has(id)) {
    return animeUserCache.get<AnimeUser>(id) ?? null;
  }

  if (query && animeUserIdCache.has(query)) {
    const userId = animeUserIdCache.get<number>(query);
    return getAnimeUser({ id: userId });
  }

  if (id) {
    query = undefined;
  }

  const apiQuery = `
  query GetUser($userId: Int, $name: String, $genreLimit: Int) {
    User(id: $userId, name: $name) {
      id
      name
      about
      createdAt
      isFollower
      isFollowing
      options {
        profileColor
      }
      statistics {
        anime {
          count
          minutesWatched
          genres(limit: $genreLimit, sort: COUNT_DESC) {
            genre
            count
          }
        }
      }
      avatar {
        large
      }
      bannerImage
    }
  }`;

  const variables = {
    userId: id,
    name: query,
    genreLimit: 5,
  };

  const json = await queryAniList(apiQuery, variables, accessToken);

  const parseResult = animeUserApiResponseSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(JSON.stringify(json, null, 2));
    console.error(parseResult.error);
    return null;
  }

  const result = parseResult.data.data.User;

  animeUserCache.set(result.id, result);
  animeUserIdCache.set(result.name, result.id);

  return result;
}

export async function getUserLastActivity(userId: number): Promise<ListActivity | null> {
  if (userLastActivityCache.has(userId)) {
    return userLastActivityCache.get<ListActivity>(userId) ?? null;
  }

  const apiQuery = `
  query GetActivityHistory($userId: Int) {
    Page(perPage: 25) {
      activities(type: ANIME_LIST, userId: $userId, sort: ID_DESC) {
        ... on ListActivity {
          media {
            id
            title {
              english
              native
              romaji
              userPreferred
            }
          }
          progress
          status
          createdAt
        }
      }
    }
  }`;

  const variables = {
    userId,
  };

  const json = await queryAniList(apiQuery, variables);

  const parseResult = listActivityHistoryApiResponseSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(JSON.stringify(json, null, 2));
    console.error(parseResult.error);
    return null;
  }

  const result = parseResult.data.data.Page.activities.find(activity =>
    ["watched episode", "rewatched episode", "completed"].includes(activity.status),
  );

  if (!result) {
    return null;
  }

  userLastActivityCache.set(userId, result);

  return result;
}

export function extractUserIdFromAccessToken(accessToken: string): number | undefined {
  const decodedToken = jwt.decode(accessToken);

  if (!decodedToken || typeof decodedToken !== "object") {
    return;
  }

  if (decodedToken.sub) {
    return parseInt(decodedToken.sub);
  }
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

  const formattedStartDate = formatDate(anime.startDate);
  const formattedEndDate = formatDate(anime.endDate);
  const dateParts = joinWithSeparator(
    [formatDate(anime.startDate), formattedStartDate !== formattedEndDate ? formattedEndDate : null],
    " - ",
  );

  const footer = joinWithSeparator([
    statusNameMap[anime.status],
    dateParts,
    anime.meanScore ? `⭐${anime.meanScore}/100` : null,
  ]);

  return new EmbedBuilder()
    .setTitle(title)
    .setURL(`https://anilist.co/anime/${anime.id}`)
    .setDescription(description)
    .setColor(anime.coverImage.color as `#${string}`)
    .setImage(anime.coverImage.extraLarge)
    .setFooter({ text: footer })
    .setThumbnail(anime.bannerImage);
}

export function getAnimeUserEmbed(user: AnimeUser, activity: ListActivity | null, discordUser?: User): EmbedBuilder {
  const joinWithSeparator = (parts: (string | null)[], separator = " • ") => parts.filter(Boolean).join(separator);
  const capitalizeFirstLetter = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  const titleParts = [user.name];
  const title = joinWithSeparator(titleParts, " ");

  const descriptionParts = [];

  if (user.isFollower || user.isFollowing) {
    const following = joinWithSeparator([
      user.isFollowing ? "Following" : null,
      user.isFollower ? "Follows you" : null,
    ]);
    if (following) descriptionParts.push(`-# ${following}`);
  }

  if (user.statistics.anime.count || user.statistics.anime.minutesWatched) {
    const { value, unit } = largestTimeUnit(user.statistics.anime.minutesWatched * 60);
    descriptionParts.push(`📈 ${user.statistics.anime.count} Anime Watched • ⏱️ ${value} ${unit}s Watched`);
  }

  if (activity) {
    const plural = activity.progress?.includes(" - ");
    let lastWatched = `📝 Last ${activity.status}${plural ? "s" : ""}`;
    if (activity.status !== "completed") {
      lastWatched += ` ${activity.progress} of`;
    }
    lastWatched += ` **${hyperlink(
      getTitle(activity.media.title),
      `https://anilist.co/anime/${activity.media.id}`,
    )}** ${time(new Date(activity.createdAt * 1000), "R")}`;
    descriptionParts.push(lastWatched);
  }

  if (user.statistics.anime.genres.length) {
    descriptionParts.push(
      [
        "🎭 Top Genres",
        "-# " + user.statistics.anime.genres.map(genre => `**${genre.genre}** (${genre.count})`).join(", "),
      ].join("\n"),
    );
  }

  if (user.about) {
    descriptionParts.push(fixHTML(removeHTML(user.about)));
  }

  const description = truncateString(descriptionParts.join("\n\n").trim(), 4096);

  const color = Colors[capitalizeFirstLetter(user.options.profileColor) as keyof typeof Colors] ?? Colors.Blurple;

  const createdDate = new Date(user.createdAt * 1000);

  return new EmbedBuilder()
    .setAuthor(
      discordUser
        ? {
            name: discordUser.displayName,
            iconURL: discordUser.avatarURL() ?? undefined,
          }
        : null,
    )
    .setTitle(title)
    .setURL(`https://anilist.co/user/${user.id}`)
    .setDescription(description)
    .setColor(color)
    .setThumbnail(user.avatar.large)
    .setFooter({ text: `📅 Joined ${createdDate.toDateString().slice(4)}` });
}

export async function getAccessToken(code: string): Promise<string | undefined> {
  const result = await fetch("https://anilist.co/api/v2/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: ENV.ANILIST_CLIENT_ID,
      client_secret: ENV.ANILIST_CLIENT_SECRET,
      redirect_uri: ENV.ANILIST_REDIRECT_URI,
      code,
    }),
  });

  if (result.ok) {
    const data = await result.json();
    return data.access_token;
  }
}

function queryAniList<T = any>(query: string, variables: Record<string, unknown>, accessToken?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })
      .then(response => response.json())
      .then(resolve)
      .catch(reject);
  });
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

export const statusNameMap: Record<string, string> = {
  FINISHED: "✅ Finished",
  RELEASING: "📅 Releasing",
  NOT_YET_RELEASED: "🔜 Not Yet Released",
  CANCELLED: "❌ Cancelled",
  HIATUS: "⏸️ Hiatus",
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

type TimeUnitPair = {
  value: number;
  unit: string;
};

function largestTimeUnit(seconds: number): TimeUnitPair {
  let value: number, unit: string;
  if (seconds < 60) {
    value = seconds;
    unit = "Second";
  } else if (seconds < 3600) {
    value = seconds / 60;
    unit = "Minute";
  } else if (seconds < 86400) {
    value = seconds / 3600;
    unit = "Hour";
  } else {
    value = seconds / 86400;
    unit = "Day";
  }

  const valueRounded = Math.round(value * 10) / 10;

  return { value: valueRounded, unit };
}
