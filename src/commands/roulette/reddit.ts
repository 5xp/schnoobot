import ExtendedClient, { applicationEmojis } from "@common/ExtendedClient";
import {
  AttachmentBuilder,
  BaseMessageOptions,
  ChannelType,
  ChatInputCommandInteraction,
  hyperlink,
  inlineCode,
  Interaction,
  time,
} from "discord.js";
import {
  listingSchema,
  NsfwFilter,
  nsfwFilterSchema,
  Post,
  PostFilterType,
  postFilterTypeSchema,
  Sorting,
  sortingSchema,
  Subreddit,
  subredditSchema,
} from "./reddit.schema";
import NodeCache from "node-cache";
import fetch from "node-fetch";
import { errorMessage, truncateString } from "@common/reply-utils";

const subredditCache = new NodeCache({ stdTTL: 60 * 60 * 24 * 1000, checkperiod: 60 });
const listingCache = new NodeCache({ stdTTL: 60 * 15 * 1000, checkperiod: 60 });

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
  const query = interaction.options.getString("query", true);
  const sorting = sortingSchema.parse(interaction.options.getString("sort", false) ?? "hot");
  const filterType = postFilterTypeSchema.parse(interaction.options.getString("type", false) ?? "image");

  const nsfwAllowed = inNsfwChannel(interaction);
  const nsfwFilter = nsfwAllowed
    ? nsfwFilterSchema.parse(interaction.options.getString("nsfw", false) ?? "all")
    : "none";

  const queries = parseQueries(query);
  const runResult = await run({
    queries,
    sorting,
    filterType,
    nsfwFilter,
  }).catch(async error => {
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
      await interaction.reply(errorMessage(error.message));
    }
  });

  if (!runResult) {
    return;
  }

  await interaction.reply(runResult.messageOptions);
}

function parseQueries(query: string): Query[] {
  const inputs = query
    .split(" ")
    .filter(q => q.length > 0)
    .map(q => q.toLowerCase());

  let queries: Query[] = [];
  inputs.forEach(input => {
    const query = queryFromString(input);

    if (query) {
      queries.push(query);
    }
  });

  return queries;
}

type SubredditQuery = {
  subreddit: string;
  type: "subreddit";
};

type UserQuery = {
  user: string;
  type: "user";
};

type MultiRedditQuery = {
  user: string;
  multi: string;
  type: "multi";
};

type Query = SubredditQuery | UserQuery | MultiRedditQuery;

function queryToString(query: Query): string {
  switch (query.type) {
    case "subreddit":
      return `r/${query.subreddit}`;
    case "user":
      return `u/${query.user}`;
    case "multi":
      return `u/${query.user}/m/${query.multi}`;
  }
}

function queryFromString(query: string): Query | undefined {
  const subredditRegex = /^(\/?r\/)?([a-z0-9-_]{2,20})\/?$/;
  const userRegex = /^\/?u\/([a-z0-9-_]{2,20})\/?$/;
  const multiRedditRegex = /(\/?u\/)?([a-z0-9-_]{2,20})\/m\/([a-z0-9-_]{2,20})\/?/;

  if (subredditRegex.test(query)) {
    const [, , subreddit] = query.match(subredditRegex)!;
    return { subreddit, type: "subreddit" };
  } else if (userRegex.test(query)) {
    const [, user] = query.match(userRegex)!;
    return { user, type: "user" };
  } else if (multiRedditRegex.test(query)) {
    const [, , user, multi] = query.match(multiRedditRegex)!;
    return { user, multi, type: "multi" };
  }
}

function inNsfwChannel(interaction: Interaction): boolean {
  return interaction.inCachedGuild() && interaction.channel?.type === ChannelType.GuildText && interaction.channel.nsfw;
}

type RunOptions = {
  queries: Query[];
  sorting: Sorting;
  filterType: PostFilterType;
  nsfwFilter: NsfwFilter;
  // numRerolls: number;
  // queryOverride?: string;
  // seenPosts: Record<string, number>;
};

type SelectedPost = {
  query: Query;
  post: Post;
};

type RunResult = {
  selectedPost: SelectedPost;
  messageOptions: BaseMessageOptions;
};

async function run(options: RunOptions): Promise<RunResult> {
  // const { queries, sorting, filterType, nsfwFilter, numRerolls, queryOverride, seenPosts } = options;
  const { queries, sorting, filterType, nsfwFilter } = options;

  const selectedQuery = await selectQuery(queries, nsfwFilter);

  console.log(selectedQuery);

  if (!selectedQuery) {
    throw new Error("No valid queries found.");
  }

  let posts = await fetchListing(selectedQuery, sorting, filterType);

  posts = filterPosts(posts, filterType, nsfwFilter);

  if (posts.length === 0) {
    throw new Error(`No posts found from ${queryToString(selectedQuery)}`);
  }

  const post = posts[Math.floor(Math.random() * posts.length)];

  const partialMessageOpts = createPostContent(post, selectedQuery);

  return {
    selectedPost: { query: selectedQuery, post },
    messageOptions: { ...partialMessageOpts },
  };
}

async function selectQuery(queries: Query[], nsfwFilter: NsfwFilter): Promise<Query | null> {
  while (true) {
    const validQueries = queries.filter(query => {
      if (query.type === "subreddit" && subredditCache.has(query.subreddit)) {
        console.log(`Checking ${query}`);
        return nsfwFilter !== "none" || !subredditCache.get<Subreddit>(query.subreddit)!.over18;
      }

      return true;
    });

    if (validQueries.length === 0) {
      return null;
    }

    const selectedQuery = validQueries[Math.floor(Math.random() * validQueries.length)];

    if (selectedQuery.type === "subreddit") {
      const subreddit = await fetchSubredditAbout(selectedQuery.subreddit);
      console.log(subreddit);

      if (nsfwFilter !== "none" || !subreddit.over18) {
        return selectedQuery;
      }
    } else {
      return selectedQuery;
    }
  }
}

async function fetchSubredditAbout(subreddit: string): Promise<Subreddit> {
  const cached = subredditCache.get<Subreddit>(subreddit);

  if (cached) {
    return cached;
  }

  console.log(`Fetching subreddit about: https://www.reddit.com/r/${encodeURIComponent(subreddit)}/about.json`);
  const response = await fetch(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/about.json`);

  const json = await response.json();

  const parseResult = subredditSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(json);
    console.error(parseResult.error);
    throw new Error("Failed to parse subreddit response");
  }

  const data = parseResult.data.data;
  subredditCache.set(subreddit, data);
  return data;
}

function getEndpoint(query: Query, sorting: Sorting, filterType: PostFilterType): string {
  let endpoint = `https://www.reddit.com/${encodeURIComponent(queryToString(query))}/`;

  if (query.type === "user") {
    endpoint += "submitted/";
  }

  switch (sorting) {
    case "hot":
      endpoint += "hot/";
      break;
    case "top":
      endpoint += "top/";
      break;
    case "top-year":
      endpoint += "top/?t=year";
      break;
    case "top-month":
      endpoint += "top/?t=month";
      break;
  }

  endpoint += ".json";

  return endpoint;
}

async function fetchListing(query: Query, sorting: Sorting, filterType: PostFilterType): Promise<Post[]> {
  const id = `${queryToString(query)}-${sorting}-${filterType}`;

  const cached = listingCache.get<Post[]>(id);

  if (cached) {
    return cached;
  }

  const endpoint = getEndpoint(query, sorting, filterType);
  const response = await fetch(endpoint);
  const json = await response.json();

  const parseResult = listingSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(json);
    console.error(parseResult.error);
    throw new Error("Failed to parse listing response");
  }

  const data = parseResult.data.data.children.map(child => child.data);
  listingCache.set(id, data);
  return data;
}

function filterPosts(posts: Post[], filterType: PostFilterType, nsfwFilter: NsfwFilter): Post[] {
  if (nsfwFilter === "none") {
    posts = posts.filter(post => !post.over_18);
  } else if (nsfwFilter === "only") {
    posts = posts.filter(post => post.over_18);
  }

  if (filterType === "media") {
    posts = posts.filter(post => post.post_hint === "image" || post.is_gallery || post.post_hint?.includes("video"));
  } else if (filterType === "image") {
    posts = posts.filter(post => post.post_hint === "image" || post.is_gallery);
  } else if (filterType === "video") {
    posts = posts.filter(post => post.post_hint?.includes("video"));
  }

  return posts;
}

function createPostContent(post: Post, query: Query): Partial<BaseMessageOptions> {
  let content = "",
    description = "";

  let attachments: AttachmentBuilder[] = [];

  let heading = `${applicationEmojis.get("reddit")} ${hyperlink(
    post.subreddit_name_prefixed,
    `<https://www.reddit.com${post.subreddit_name_prefixed}>`,
  )} • ${hyperlink(post.title, `<https://www.reddit.com${post.permalink}>`)} ${time(post.created, "R")}`;

  if (post.post_hint) {
    heading += ` ${hyperlink(inlineCode("🔗Link"), post.url)}`;
  }

  if (post.is_gallery) {
    const imageUrls = post.gallery_data!.items.map((item, index) => {
      return `https://i.redd.it/${item.media_id}.jpg`;
    });
    attachments = imageUrls.map(url => new AttachmentBuilder(url)).slice(0, 10);
    // let imagesString = "";
    // for (const imageUrl of imageUrls) {
    //   imagesString += ` ${hyperlink(inlineCode("🖼️"), imageUrl)}`;
    // }
    // heading += imagesString;
  }

  if (post.selftext) {
    description = post.selftext.replace(/\n/g, "\n> ");
    description = `> ${description}`;
  }

  const footer = `-# From ${queryToString(query)}`;

  const totalLength = heading.length + description.length + footer.length;

  if (totalLength > 2000) {
    // Subtract 3 for the newlines when
    description = truncateString(description, 2000 - (heading.length + footer.length) - 3);
  }

  content = heading;

  if (description) {
    content += `\n${description}`;
  }

  content += `\n${footer}`;

  return { content, ...(attachments.length > 0 && { files: attachments }) };
}
