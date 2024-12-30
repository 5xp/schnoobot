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

export const mediaStatusEnum = z.enum(["FINISHED", "RELEASING", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]);

export type MediaStatus = z.infer<typeof mediaStatusEnum>;

export const searchResultSchema = z.object({
  id: z.number(),
  title: z.object({
    romaji: z.string().nullable(),
    native: z.string().nullable(),
    english: z.string().nullable(),
  }),
  meanScore: z.number().nullable(),
  isAdult: z.boolean(),
  format: mediaFormatEnum.nullable(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResultApiResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      media: z.array(searchResultSchema),
    }),
  }),
});

export type SearchResultApiResponse = z.infer<typeof searchResultApiResponseSchema>;

export const animeSchema = z
  .object({
    description: z.string(),
    episodes: z.number().nullable(),
    status: mediaStatusEnum,
    genres: z.array(z.string()),
    startDate: z.object({
      year: z.number().nullable(),
      month: z.number().nullable(),
      day: z.number().nullable(),
    }),
    endDate: z.object({
      year: z.number().nullable(),
      month: z.number().nullable(),
      day: z.number().nullable(),
    }),
    bannerImage: z.string().nullable(),
    coverImage: z.object({
      color: z.string().nullable(),
      extraLarge: z.string(),
    }),
  })
  .merge(searchResultSchema);

export type Anime = z.infer<typeof animeSchema>;

export const animeApiResponseSchema = z.object({
  data: z.object({
    Media: animeSchema,
  }),
});

export type AnimeApiResponse = z.infer<typeof animeApiResponseSchema>;
