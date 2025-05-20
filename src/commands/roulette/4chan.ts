import ExtendedClient, { applicationEmojis } from "@common/ExtendedClient";
import { errorContainerMessage, errorMessage, truncateString } from "@common/reply-utils";
import {
	ActionRowBuilder,
	AutocompleteInteraction,
	bold,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	ChatInputCommandInteraction,
	ContainerBuilder,
	hideLinkEmbed,
	hyperlink,
	Interaction,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageComponentInteraction,
	MessageFlags,
	SeparatorSpacingSize,
	TextDisplayBuilder,
	time,
} from "discord.js";
import fuzzysort from "fuzzysort";
import NodeCache from "node-cache";
import boards from "./4chan.boards";
import {
	catalogSchema,
	CatalogThread,
	ThreadFilterType,
	threadFilterTypeSchema,
	ThreadPost,
	threadSchema,
} from "./4chan.schema";

const maxMessageCommentFallbackLength = 150;
const maxAutocompleteCommentFallbackLength = 50;

const rerollKeepBoardButton = new ButtonBuilder()
	.setLabel("Reroll")
	.setStyle(ButtonStyle.Secondary)
	.setCustomId("reroll-board")
	.setEmoji("🎲");
const rerollKeepThreadButton = new ButtonBuilder()
	.setLabel("Reroll in thread")
	.setStyle(ButtonStyle.Secondary)
	.setCustomId("reroll-thread")
	.setEmoji("🔀");

const catalogCache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 60 });
const threadCache = new NodeCache({ stdTTL: 10 * 60, checkperiod: 30 });

const IDLE_TIMEOUT = 180_000;

export async function autocomplete(interaction: AutocompleteInteraction, client: ExtendedClient): Promise<void> {
	const focusedOption = interaction.options.getFocused(true);
	const nsfwAllowed = inNsfwChannel(interaction);

	switch (focusedOption.name) {
		case "board":
			return autocompleteBoard(interaction, client, nsfwAllowed);
		case "thread":
			return autocompleteThread(interaction, client, nsfwAllowed);
	}
}

async function autocompleteBoard(
	interaction: AutocompleteInteraction,
	_: ExtendedClient,
	nsfwAllowed: boolean,
): Promise<void> {
	const focusedValue = interaction.options.getFocused();

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

async function autocompleteThread(
	interaction: AutocompleteInteraction,
	_: ExtendedClient,
	nsfwAllowed: boolean,
): Promise<void> {
	const focusedValue = interaction.options.getFocused();
	const board = interaction.options.getString("board", true);
	const b = boards.find(b => b.value === board);

	if (!b) {
		await interaction.respond([{ name: "Invalid board. Select a valid board first.", value: "" }]);
		return;
	}

	if (!nsfwAllowed && b.nsfw) {
		await interaction.respond([{ name: "NSFW boards are not allowed here. Select a valid board.", value: "" }]);
		return;
	}

	let options: { name: string; value: string }[] = [];

	if (focusedValue) {
		options.push(
			{
				name: `Threads with "${truncateString(focusedValue, 100 - 36)}" in title or subtitle`,
				value: focusedValue,
			},
			{
				name: `Threads with "${truncateString(focusedValue, 100 - 29)}" in title only`,
				value: `title:${focusedValue}`,
			},
			{
				name: `Threads with "${truncateString(focusedValue, 100 - 32)}" in subtitle only`,
				value: `subtitle:${focusedValue}`,
			},
		);
	}

	const threads = await fetchCatalog(interaction.options.getString("board", true));
	let sortedThreads = threads;

	if (!focusedValue) {
		sortedThreads = sortedThreads.sort((a, b) => b.images - a.images).slice(0, 25 - options.length);
	} else {
		sortedThreads = fuzzysort
			.go(focusedValue, threads, {
				keys: ["sub", "com", "no"],
				limit: 25 - options.length,
			})
			.map(result => result.obj);
	}

	options = options.concat(
		sortedThreads.map(thread => {
			let name = "";

			if (thread.sub) {
				name += fixHTML(removeHTML(thread.sub));
			} else if (thread.com) {
				let comment = fixHTML(removeHTML(thread.com)).split("\n")[0];
				comment = truncateString(comment, maxAutocompleteCommentFallbackLength);
				name += comment;
			}

			name += ` (💬 ${thread.replies} 📸 ${thread.images})`;

			return { name, value: `no:${thread.no}` };
		}),
	);

	options.forEach(option => {
		option.name = option.name.slice(0, 100);
		option.value = option.value.slice(0, 100);
	});

	await interaction.respond(options);
}

export default async function execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
	const board = interaction.options.getString("board", true);
	const threadQuery = interaction.options.getString("thread", false);

	const filterType = threadFilterTypeSchema.parse(interaction.options.getString("type", false) ?? "image");

	const nsfwAllowed = inNsfwChannel(interaction);

	let numRerolls = 0;

	const excludeThreads: number[] = [];
	const seenPostsCount: Record<number, number> = {};

	const runResult = await run({
		board,
		threadQuery,
		filterType,
		nsfwAllowed,
		numRerolls,
		excludeThreads,
		seenPostsCount,
	}).catch(async error => {
		if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
			await interaction.reply(errorMessage(error.message));
		}
	});

	if (!runResult) {
		return;
	}

	await interaction.deferReply();
	const response = await interaction.editReply({
		components: [runResult.container],
		flags: MessageFlags.IsComponentsV2,
	});
	const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
	const componentCollector = response.createMessageComponentCollector({ filter, idle: IDLE_TIMEOUT });

	let lastThreadNo = runResult.selectedPost.threadNo;
	let lastContainer = runResult.container;

	componentCollector.on("collect", async i => {
		numRerolls++;

		const nextRunResult = await run({
			board,
			threadQuery,
			filterType,
			nsfwAllowed,
			numRerolls,
			excludeThreads,
			seenPostsCount,
			...(i.customId === "reroll-thread" ? { threadOverride: lastThreadNo } : {}),
		}).catch(async error => {
			if (
				typeof error === "object" &&
				error !== null &&
				"message" in error &&
				typeof error.message === "string"
			) {
				await i.update(errorContainerMessage(error.message)).catch(() => null);
			}
		});

		if (!nextRunResult) {
			return;
		}

		lastThreadNo = nextRunResult.selectedPost.threadNo;
		lastContainer = nextRunResult.container;

		await i
			.update({
				components: [nextRunResult.container],
				flags: MessageFlags.IsComponentsV2,
			})
			.catch(() => null);
	});

	componentCollector.on("end", async () => {
		lastContainer = lastContainer.spliceComponents(-2, 2);
		await interaction
			.editReply({ components: [lastContainer], flags: MessageFlags.IsComponentsV2 })
			.catch(() => null);
	});

	componentCollector.on("ignore", async i => {
		await i.reply(errorContainerMessage("Only the user who initiated the command can reroll."));
	});
}

type SelectedPost = {
	board: string;
	threadNo: number;
	postNo?: number;
};

type RunOptions = {
	board: string;
	threadQuery: string | null;
	filterType: ThreadFilterType;
	nsfwAllowed: boolean;
	numRerolls: number;
	threadOverride?: number;
	excludeThreads: number[];
	seenPostsCount: Record<number, number>;
};

type RunResult = {
	selectedPost: SelectedPost;
	container: ContainerBuilder;
};

async function run(options: RunOptions): Promise<RunResult> {
	const { board, threadQuery, filterType, nsfwAllowed, threadOverride, numRerolls, excludeThreads, seenPostsCount } =
		options;

	const b = boards.find(b => b.value === board);

	if (!b) {
		throw new Error("Invalid board.");
	}

	if (!nsfwAllowed && b.nsfw) {
		throw new Error("NSFW boards are not allowed in this channel.");
	}

	let threads = await fetchCatalog(board);

	threads = filterThreads(threads, threadQuery, threadOverride ?? null, excludeThreads);

	if (threads.length === 0) {
		throw new Error("No threads found with the given criteria.");
	}

	const thread = getRandomThread(threads, filterType);

	const { posts, post, replyCount, imageCount, videoCount } = await getRandomPost(
		board,
		thread,
		filterType,
		seenPostsCount,
	);

	if (!post) {
		excludeThreads.push(thread.no);
	} else {
		seenPostsCount[post.no] = (seenPostsCount[post.no] || 0) + 1;
	}

	const replies = posts.filter(p => p.com && fixHTML(removeHTML(p.com)).includes(`>>${post.no}`)).map(p => p.no);

	const container = createPostContainer(post, replies, board, thread, numRerolls, replyCount, imageCount, videoCount);

	const actionRow = new ActionRowBuilder<ButtonBuilder>();

	if (posts.length > 1 || threads.length > 1) {
		actionRow.addComponents(rerollKeepBoardButton);
	}

	if ((posts.length > 1 && threads.length > 1) || threadOverride) {
		actionRow.addComponents(rerollKeepThreadButton);
	}

	container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(actionRow);

	return {
		selectedPost: { board, threadNo: thread.no, postNo: post?.no },
		container,
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
	threadQuery: string | null,
	threadOverride: number | null,
	excludeThreads: number[],
): CatalogThread[] {
	if (threadOverride) {
		return threads.filter(thread => thread.no === threadOverride);
	}

	if (!threadQuery) {
		return threads;
	}

	threads = threads.filter(thread => !excludeThreads.includes(thread.no));

	if (threadQuery.startsWith("no:")) {
		const no = Number(threadQuery.slice(3));

		return threads.filter(thread => thread.no === no);
	} else if (threadQuery.startsWith("title:")) {
		const title = threadQuery.slice(6);

		return threads.filter(thread => thread.sub?.toLowerCase().includes(title.toLowerCase()));
	} else if (threadQuery.startsWith("subtitle:")) {
		const subtitle = threadQuery.slice(9);

		return threads.filter(thread => thread.com?.toLowerCase().includes(subtitle.toLowerCase()));
	} else {
		return threads.filter(thread => {
			const title = thread.sub?.toLowerCase() || "";
			const subtitle = thread.com?.toLowerCase() || "";

			return title.includes(threadQuery.toLowerCase()) || subtitle.includes(threadQuery.toLowerCase());
		});
	}
}

function getRandomThread(threads: CatalogThread[], filterType: ThreadFilterType): CatalogThread {
	const totalReplies = threads.reduce(
		(acc, thread) => acc + (filterType !== "all" ? thread.images : thread.replies),
		0,
	);

	const randomIndex = Math.floor(Math.random() * totalReplies);

	let index = 0;

	for (const thread of threads) {
		index += filterType !== "all" ? thread.images : thread.replies;

		if (index >= randomIndex) {
			return thread;
		}
	}

	return threads[threads.length - 1];
}

async function getRandomPost(
	board: string,
	thread: CatalogThread,
	filterType: ThreadFilterType,
	seenPosts: Record<number, number>,
) {
	let posts = await fetchThread(board, thread.no);

	if (posts[0].filename) {
		thread.images++;
	}

	const replyCount = ++thread.replies;
	let imageCount: number, videoCount: number;

	if (filterType !== "all") {
		posts = posts.filter(post => post.filename);
	}

	const videoPosts = posts.filter(post => post.ext === ".webm" || post.ext === ".mp4");
	videoCount = videoPosts.length;
	imageCount = thread.images - videoCount;

	if (filterType === "video") {
		posts = videoPosts;
	}

	const post = selectPost(posts, seenPosts);

	return { posts, post, replyCount, imageCount, videoCount };
}

function selectPost(posts: ThreadPost[], seenPosts: Record<number, number>): ThreadPost {
	const weights: Record<number, number> = {};

	posts.forEach(post => {
		const weight = seenPosts[post.no] || 0;
		weights[post.no] = (1 / (weight + 1)) ** 2;
	});

	const totalWeight = Object.values(weights).reduce((acc, weight) => acc + weight, 0);
	const randomWeight = Math.random() * totalWeight;

	let weightSum = 0;

	for (const post of posts) {
		weightSum += weights[post.no];

		if (weightSum >= randomWeight) {
			return post;
		}
	}

	return posts[posts.length - 1];
}

function createPostContainer(
	post: ThreadPost | undefined,
	replies: number[],
	board: string,
	thread: CatalogThread,
	numRerolls: number,
	replyCount: number,
	imageCount: number,
	videoCount: number,
): ContainerBuilder {
	const container = new ContainerBuilder();

	let description = "";

	let totalTextLength = 0;
	let heading = `${applicationEmojis.get("4chan")} /${board}/`;

	if (!thread.sub && thread.com) {
		thread.sub = truncateString(fixHTML(removeHTML(thread.com)).split("\n")[0], maxMessageCommentFallbackLength);
	}

	if (thread.sub) {
		heading += ` • ${bold(fixHTML(removeHTML(thread.sub)))}`;
	}

	if (!post) {
		heading = hyperlink(heading, `<https://boards.4chan.org/${board}/thread/${thread.no}>`);
		description = bold("No posts matching the criteria were found.");
	}

	heading = `### ${heading}`;

	totalTextLength += heading.length;
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(heading));

	if (post) {
		let headingSubtext: string = hyperlink(
			`**No. ${post.no}**`,
			`<https://boards.4chan.org/${board}/thread/${thread.no}#p${post.no}>`,
		);
		if (post.name !== "Anonymous") {
			headingSubtext = `${bold(post.name)} ${headingSubtext}`;
		}
		headingSubtext += " " + time(post.time, "R");

		if (replies.length > 0) {
			headingSubtext += " ";
			headingSubtext += replies
				.map(reply =>
					hyperlink(`**>>${reply}**`, `<https://boards.4chan.org/${board}/thread/${thread.no}#p${reply}>`),
				)
				.join(" ");
		}

		headingSubtext = `-# ${headingSubtext}`;

		totalTextLength += headingSubtext.length;

		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headingSubtext));
	}

	if (post?.com) {
		description = fixHTML(removeHTML(post.com));
		description = description
			.replace(/https?:\/\/[^\s]+/g, hideLinkEmbed)
			.replace(/>>>\/(\w+)\/(\d+)/g, `[**>>>/$1/$2**](<https://boards.4chan.org/$1/thread/$2#p$2>)`)
			.replace(/>>(\d+)/g, `[**>>$1**](<https://boards.4chan.org/${board}/thread/${thread.no}#p$1>)`)
			.replace(`>>${thread.no}`, `>>${thread.no} (OP)`)
			.replace(/\n/g, "\n> ");

		description = `> ${description}`;
	}

	const footer = `-# Reroll #${numRerolls} • **💬 ${replyCount} 🖼️ ${imageCount} 🎞️ ${videoCount}**`;

	totalTextLength += footer.length;

	if (totalTextLength + description.length > 4000) {
		description = truncateString(description, 4000 - totalTextLength - 1);
	}

	if (description || post?.filename) {
		container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
	}

	if (description) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
	}

	if (post?.filename) {
		container.addMediaGalleryComponents(
			new MediaGalleryBuilder().addItems(
				new MediaGalleryItemBuilder()
					.setURL(`https://i.4cdn.org/${board}/${post?.tim}${post?.ext}`)
					.setSpoiler(post?.spoiler === 1),
			),
		);
	}

	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));

	return container;
}

function inNsfwChannel(interaction: Interaction): boolean {
	return (
		interaction.inCachedGuild() && interaction.channel?.type === ChannelType.GuildText && interaction.channel.nsfw
	);
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
	return text
		.replace(/<\s*s\s*>([\s\S]*?)<\s*\/\s*s\s*>/g, "||$1||")
		.replace(/<\s*br.*?>/g, "\n")
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
