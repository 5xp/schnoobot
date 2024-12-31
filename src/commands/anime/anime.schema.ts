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

/**
 * Anime Search
 */
export const animeSearchResultSchema = z.object({
  id: z.number(),
  title: z.object({
    romaji: z.string().nullable(),
    native: z.string().nullable(),
    english: z.string().nullable(),
    userPreferred: z.string().nullable(),
  }),
  meanScore: z.number().nullable(),
  isAdult: z.boolean(),
  format: mediaFormatEnum.nullable(),
});

export type AnimeSearchResult = z.infer<typeof animeSearchResultSchema>;

export const animeSearchResultApiResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      media: z.array(animeSearchResultSchema),
    }),
  }),
});

export type AnimeSearchResultApiResponse = z.infer<typeof animeSearchResultApiResponseSchema>;

/**
 * Anime
 */
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
  .merge(animeSearchResultSchema);

export type Anime = z.infer<typeof animeSchema>;

export const animeApiResponseSchema = z.object({
  data: z.object({
    Media: animeSchema,
  }),
});

export type AnimeApiResponse = z.infer<typeof animeApiResponseSchema>;

/**
 * User Search
 */
export const animeUserSearchResultSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export type AnimeUserSearchResult = z.infer<typeof animeUserSearchResultSchema>;

export const animeUserSearchResultApiResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      users: z.array(animeUserSearchResultSchema),
    }),
  }),
});

/**
 * User
 */
export type AnimeUserSearchResultApiResponse = z.infer<typeof animeUserSearchResultApiResponseSchema>;

export const animeUserSchema = z
  .object({
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
  })
  .merge(animeUserSearchResultSchema);

export type AnimeUser = z.infer<typeof animeUserSchema>;

export const animeUserApiResponseSchema = z.object({
  data: z.object({
    User: animeUserSchema,
  }),
});

export type AnimeUserApiResponse = z.infer<typeof animeUserApiResponseSchema>;

// {
//   "data": {
//     "Activity": {
//       "media": {
//         "title": {
//           "english": "To Every You I’ve Loved Before",
//           "native": "僕が愛したすべての君へ",
//           "romaji": "Boku ga Aishita Subete no Kimi e",
//           "userPreferred": "Boku ga Aishita Subete no Kimi e"
//         }
//       },
//       "progress": null,
//       "status": "completed"
//     }
//   }
// }

export const animeActivitySchema = z.object({
  media: z.object({
    id: z.number(),
    title: z.object({
      english: z.string().nullable(),
      native: z.string().nullable(),
      romaji: z.string().nullable(),
      userPreferred: z.string().nullable(),
    }),
  }),
  progress: z.string().nullable(),
  status: z.string(),
  createdAt: z.number(),
});

export type AnimeActivity = z.infer<typeof animeActivitySchema>;

export const animeActivityHistoryApiResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      activities: z.array(animeActivitySchema),
    }),
  }),
});

export type AnimeActivityHistoryApiResponse = z.infer<typeof animeActivityHistoryApiResponseSchema>;
