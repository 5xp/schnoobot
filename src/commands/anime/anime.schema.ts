import { z } from "zod";

export const mediaFormatEnum = z.enum([
	"TV",
	"TV_SHORT",
	"MOVIE",
	"SPECIAL",
	"OVA",
	"ONA",
	"MUSIC",
	"MANGA",
	"NOVEL",
	"ONE_SHOT",
]);

export type MediaFormat = z.infer<typeof mediaFormatEnum>;

const mediaStatusEnum = z.enum(["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]);

type MediaStatus = z.infer<typeof mediaStatusEnum>;

export const mediaListStatusEnum = z.enum(["CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED", "REPEATING"]);

export type MediaListStatus = z.infer<typeof mediaListStatusEnum>;

export const fuzzyDateSchema = z.object({
	year: z.number().nullable(),
	month: z.number().nullable(),
	day: z.number().nullable(),
});

export const mediaListEntrySchema = z.object({
	id: z.number(),
	status: mediaListStatusEnum,
	repeat: z.number(),
	progress: z.number(),
	score: z.number().nullable(),
	startedAt: fuzzyDateSchema,
	completedAt: fuzzyDateSchema,
	createdAt: z.number(),
});

export type MediaListEntry = z.infer<typeof mediaListEntrySchema>;

export const mediaListEntryApiResponseSchema = z.object({
	data: z.object({
		MediaList: mediaListEntrySchema.nullable(),
	}),
});

type MediaListEntryApiResponse = z.infer<typeof mediaListEntryApiResponseSchema>;

export const titleSchema = z.object({
	romaji: z.string().nullable(),
	native: z.string().nullable(),
	english: z.string().nullable(),
	userPreferred: z.string().nullable(),
});

export const mediaSchema = z.object({
	id: z.number(),
	title: titleSchema,
	meanScore: z.number().nullable(),
	isAdult: z.boolean(),
	format: mediaFormatEnum.nullable(),
	description: z.string().nullable(),
	episodes: z.number().nullable(),
	status: mediaStatusEnum,
	genres: z.array(z.string()),
	startDate: fuzzyDateSchema,
	endDate: fuzzyDateSchema,
	bannerImage: z.string().nullable(),
	coverImage: z.object({
		color: z.string().nullable(),
		extraLarge: z.string(),
	}),
});

const animeSearchResultSchema = mediaSchema.pick({
	id: true,
	title: true,
	meanScore: true,
	isAdult: true,
	format: true,
});

export type AnimeSearchResult = z.infer<typeof animeSearchResultSchema>;

export const animeSearchResultApiResponseSchema = z.object({
	data: z.object({
		Page: z.object({
			media: z.array(animeSearchResultSchema),
		}),
	}),
});

type AnimeSearchResultApiResponse = z.infer<typeof animeSearchResultApiResponseSchema>;

const animeSchema = mediaSchema.pick({
	id: true,
	title: true,
	meanScore: true,
	isAdult: true,
	format: true,
	description: true,
	episodes: true,
	status: true,
	genres: true,
	startDate: true,
	endDate: true,
	bannerImage: true,
	coverImage: true,
});

export type Anime = z.infer<typeof animeSchema>;

export const animeApiResponseSchema = z.object({
	data: z.object({
		Media: animeSchema,
	}),
});

type AnimeApiResponse = z.infer<typeof animeApiResponseSchema>;

const animeUserSchema = z.object({
	id: z.number(),
	name: z.string(),
	about: z.string().nullable(),
	createdAt: z.number(),
	isFollower: z.boolean(),
	isFollowing: z.boolean(),
	options: z.object({
		profileColor: z.string(),
	}),
	statistics: z.object({
		anime: z.object({
			count: z.number(),
			minutesWatched: z.number(),
			genres: z.array(
				z.object({
					genre: z.string(),
					count: z.number(),
				}),
			),
		}),
	}),
	avatar: z.object({
		large: z.string(),
	}),
	bannerImage: z.string().nullable(),
});

export type AnimeUser = z.infer<typeof animeUserSchema>;

const animeUserSearchResultSchema = animeUserSchema.pick({
	id: true,
	name: true,
});

export type AnimeUserSearchResult = z.infer<typeof animeUserSearchResultSchema>;

export const animeUserSearchResultApiResponseSchema = z.object({
	data: z.object({
		Page: z.object({
			users: z.array(animeUserSearchResultSchema),
		}),
	}),
});

type AnimeUserSearchResultApiResponse = z.infer<typeof animeUserSearchResultApiResponseSchema>;

export const animeUserApiResponseSchema = z.object({
	data: z.object({
		User: animeUserSchema,
	}),
});

type AnimeUserApiResponse = z.infer<typeof animeUserApiResponseSchema>;

const listActivitySchema = z.object({
	media: z.object({
		id: z.number(),
		title: titleSchema,
	}),
	progress: z.string().nullable(),
	status: z.string(),
	createdAt: z.number(),
});

export type ListActivity = z.infer<typeof listActivitySchema>;

export const listActivityHistoryApiResponseSchema = z.object({
	data: z.object({
		Page: z.object({
			activities: z.array(listActivitySchema),
		}),
	}),
});

type ListActivityHistoryApiResponse = z.infer<typeof listActivityHistoryApiResponseSchema>;
