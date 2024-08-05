import ExtendedClient from "@common/ExtendedClient";
import { errorMessage } from "@common/reply-utils";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Interaction,
  MessageComponentInteraction,
  MessageCreateOptions,
} from "discord.js";
import fuzzysort from "fuzzysort";
import NodeCache from "node-cache";
import boards from "./4chan.boards";
import { catalogSchema, CatalogThread, ThreadPost, threadSchema } from "./4chan.schema";

const rerollKeepBoardButton = new ButtonBuilder()
  .setLabel("Reroll")
  .setStyle(ButtonStyle.Secondary)
  .setCustomId("reroll-board")
  .setEmoji("🎲");
const rerollKeepThreadButton = new ButtonBuilder()
  .setLabel("Reroll (keep thread)")
  .setStyle(ButtonStyle.Secondary)
  .setCustomId("reroll-thread")
  .setEmoji("🔀");
const loadingButton = new ButtonBuilder()
  .setLabel("Loading...")
  .setStyle(ButtonStyle.Secondary)
  .setCustomId("loading")
  .setDisabled(true);

const catalogCache = new NodeCache({ stdTTL: 10 * 60 * 1000, checkperiod: 60 });
const threadCache = new NodeCache({ stdTTL: 60 * 1000, checkperiod: 30 });

type RunOptions = {
  board: string;
  threadNo: number | null;
  threadTitle: string | null;
  threadSubtitle: string | null;
  excludeText: boolean;
  videosOnly: boolean;
  nsfwAllowed: boolean;
  numRerolls: number;
  threadOverride?: number;
};

export async function autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
  const focusedValue = interaction.options.getFocused();
  const nsfwAllowed = inNsfwChannel(interaction);

  const options = boards
    .filter(board => nsfwAllowed || !board.nsfw)
    .map(board => ({
      name: board.name,
      value: board.value,
    }));

  if (focusedValue) {
    const results = fuzzysort.go(focusedValue, options, {
      keys: ["name", "value"],
      limit: 25,
    });
    await interaction.respond(results.map(result => ({ name: result.obj.name, value: result.obj.value })));
    return;
  }

  await interaction.respond(options.slice(0, 25));
}

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  const board = interaction.options.getString("board", true);
  const threadNo = interaction.options.getInteger("thread-no");
  const threadTitle = interaction.options.getString("thread-title");
  const threadSubtitle = interaction.options.getString("thread-subtitle");
  const excludeText = interaction.options.getBoolean("exclude-text") ?? false;
  const videosOnly = interaction.options.getBoolean("videos-only") ?? false;
  const nsfwAllowed = inNsfwChannel(interaction);

  let numRerolls = 0;

  const runResult = await run({
    board,
    threadNo,
    threadTitle,
    threadSubtitle,
    excludeText,
    videosOnly,
    nsfwAllowed,
    numRerolls,
  }).catch(async error => {
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
      await interaction.reply(errorMessage(error.message));
    }
  });

  if (!runResult) {
    return;
  }

  await interaction.deferReply();
  const response = await interaction.editReply(runResult.messageOptions);
  const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
  const componentCollector = response.createMessageComponentCollector({ filter, idle: 80_000 });

  let lastThreadNo = runResult.selectedPost.threadNo;

  componentCollector.on("collect", async i => {
    numRerolls++;

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(loadingButton);
    await i.update({ components: [actionRow] });

    const nextRunResult = await run({
      board,
      threadNo,
      threadTitle,
      threadSubtitle,
      excludeText,
      videosOnly,
      nsfwAllowed,
      numRerolls,
      ...(i.customId === "reroll-thread" ? { threadOverride: lastThreadNo } : {}),
    }).catch(async error => {
      if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
        await i.editReply(errorMessage(error.message));
      }
    });

    if (!nextRunResult) {
      return;
    }

    lastThreadNo = nextRunResult.selectedPost.threadNo;

    await i.editReply(nextRunResult.messageOptions).catch(() => null);
  });

  componentCollector.on("end", async () => {
    await interaction.editReply({ components: [] }).catch(() => null);
  });

  componentCollector.on("ignore", async i => {
    await i.reply(errorMessage("Only the user who initiated the command can reroll."));
  });
}

type SelectedPost = {
  board: string;
  threadNo: number;
  postNo?: number;
};

type RunResult = {
  selectedPost: SelectedPost;
  messageOptions: MessageCreateOptions;
};

async function run(options: RunOptions): Promise<RunResult> {
  const {
    board,
    threadNo,
    threadTitle,
    threadSubtitle,
    excludeText,
    videosOnly,
    nsfwAllowed,
    threadOverride,
    numRerolls,
  } = options;

  const b = boards.find(b => b.value === board);

  if (!b) {
    console.log(boards);
    throw new Error("Invalid board.");
  }

  if (!nsfwAllowed && b.nsfw) {
    throw new Error("NSFW boards are not allowed in this channel.");
  }

  let threads = await fetchCatalog(board);

  threads = filterThreads(threads, threadTitle, threadSubtitle, threadOverride ?? threadNo);

  if (threads.length === 0) {
    throw new Error("No threads found with the given criteria.");
  }

  const thread = getRandomThread(threads, excludeText);

  const { post, replyCount, imageCount, videoCount } = await getRandomPost(board, thread, excludeText, videosOnly);

  const { embed, content, attachment } = createPostEmbed(
    post,
    board,
    thread,
    numRerolls,
    replyCount,
    imageCount,
    videoCount,
  );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(rerollKeepBoardButton);

  if (threads.length > 1 || threadOverride) {
    actionRow.addComponents(rerollKeepThreadButton);
  }

  return {
    selectedPost: { board, threadNo: thread.no, postNo: post?.no },
    messageOptions: {
      content,
      files: attachment ? [attachment] : [],
      embeds: [embed],
      components: [actionRow],
    },
  };
}

async function fetchCatalog(board: string): Promise<CatalogThread[]> {
  const cached = catalogCache.get<CatalogThread[]>(board);

  if (cached) {
    return cached;
  }

  const url = `https://a.4cdn.org/${board}/catalog.json`;
  const response = await fetch(url);
  const json = await response.json();

  const catalogParseResult = catalogSchema.safeParse(json);

  if (!catalogParseResult.success) {
    console.error(json);
    console.error(catalogParseResult.error);
    throw new Error("Error parsing catalog.");
  }

  const threads: CatalogThread[] = catalogParseResult.data.flatMap(page => page.threads);

  catalogCache.set(board, threads);

  return threads;
}

function filterThreads(
  threads: CatalogThread[],
  title: string | null,
  subtitle: string | null,
  threadNo: number | null,
): CatalogThread[] {
  if (threadNo) {
    return threads.filter(thread => thread.no === threadNo);
  }

  if (title) {
    threads = threads.filter(thread => thread.sub?.toLowerCase().includes(title.toLowerCase()));
  }

  if (subtitle) {
    threads = threads.filter(thread => thread.com?.toLowerCase().includes(subtitle.toLowerCase()));
  }

  return threads;
}

function getRandomThread(threads: CatalogThread[], excludeText: boolean): CatalogThread {
  const totalReplies = threads.reduce((acc, thread) => acc + (excludeText ? thread.images : thread.replies), 0);

  const randomIndex = Math.floor(Math.random() * totalReplies);

  let index = 0;

  for (const thread of threads) {
    index += excludeText ? thread.images : thread.replies;

    if (index >= randomIndex) {
      return thread;
    }
  }

  return threads[threads.length - 1];
}

async function getRandomPost(board: string, thread: CatalogThread, excludeText: boolean, videosOnly: boolean) {
  let posts = await fetchThread(board, thread.no);

  if (posts[0].filename) {
    thread.images++;
  }

  const replyCount = ++thread.replies;
  let imageCount: number, videoCount: number;

  if (excludeText) {
    posts = posts.filter(post => post.filename);
  }

  const videoPosts = posts.filter(post => post.ext === ".webm" || post.ext === ".mp4");
  videoCount = videoPosts.length;
  imageCount = thread.images - videoCount;

  if (videosOnly) {
    posts = videoPosts;
  }

  const post = posts.length === 0 ? undefined : posts[Math.floor(Math.random() * posts.length)];

  return { post, replyCount, imageCount, videoCount };
}

function createPostEmbed(
  post: ThreadPost | undefined,
  board: string,
  thread: CatalogThread,
  numRerolls: number,
  replyCount: number,
  imageCount: number,
  videoCount: number,
) {
  let content = "";
  let attachment: AttachmentBuilder | undefined;

  const embed = new EmbedBuilder().setColor("#3f9031");

  if (post) {
    post.name ??= "Anonymous";

    embed
      .setTitle(`/${board}/ • ${post.name} • ${post.no}`)
      .setURL(`https://boards.4chan.org/${board}/thread/${thread.no}#p${post.no}`)
      .setTimestamp(post.time * 1000);
  } else {
    embed
      .setTitle(`/${board}/`)
      .setURL(`https://boards.4chan.org/${board}/thread/${thread.no}`)
      .setColor("Red")
      .setDescription("No posts matched the given criteria.");
  }

  if (post?.com) {
    let description = fixHTML(removeHTML(post.com));
    description = description.replace(
      /\>\>(\d+)/g,
      `[>>$1](https://boards.4chan.org/${board}/thread/${thread.no}#p$1)`,
    );
    embed.setDescription(description);
  }

  if (post?.filename) {
    if (post.ext === ".webm" || post.ext === ".mp4") {
      // Include the link in the content so mobile users can click on it
      content = `https://i.4cdn.org/${board}/${post.tim}${post.ext}`;
      attachment = new AttachmentBuilder(`https://i.4cdn.org/${board}/${post.tim}${post.ext}`);
    } else {
      embed.setImage(`https://i.4cdn.org/${board}/${post.tim}${post.ext}`);
    }
  }

  let footer = `Reroll #${numRerolls}`;

  if (thread.sub) {
    footer += ` • ${fixHTML(thread.sub)}`;
  }

  footer += ` • ${replyCount}R/${imageCount}I/${videoCount}V`;

  embed.setFooter({ text: footer });

  return { embed, content, attachment };
}

function inNsfwChannel(interaction: Interaction): boolean {
  return interaction.inCachedGuild() && interaction.channel?.type === ChannelType.GuildText && interaction.channel.nsfw;
}

async function fetchThread(board: string, thread: number): Promise<ThreadPost[]> {
  const key = `${board}-${thread}`;
  const cached = threadCache.get<ThreadPost[]>(key);

  if (cached) {
    return cached;
  }

  const url = `https://a.4cdn.org/${board}/thread/${thread}.json`;
  const response = await fetch(url);
  const json = await response.json();

  const threadPostsParseResult = threadSchema.safeParse(json);

  if (!threadPostsParseResult.success) {
    console.error(json);
    console.error(threadPostsParseResult.error);
    throw new Error("Error parsing thread posts.");
  }

  const threadPosts = threadPostsParseResult.data.posts;

  threadCache.set(key, threadPosts);

  return threadPosts;
}

function removeHTML(text: string): string {
  return text.replace(/<\s*br.*?>/g, "\n").replace(/<(.*?)>/g, "");
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
