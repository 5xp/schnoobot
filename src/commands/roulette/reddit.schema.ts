import { z } from "zod";

export const postFilterTypeSchema = z.union([
  z.literal("all"),
  z.literal("media"),
  z.literal("image"),
  z.literal("video"),
]);
export type PostFilterType = z.infer<typeof postFilterTypeSchema>;

export const sortingSchema = z.union([
  z.literal("hot"),
  z.literal("top"),
  z.literal("top-year"),
  z.literal("top-month"),
]);
export type Sorting = z.infer<typeof sortingSchema>;

export const nsfwFilterSchema = z.union([z.literal("all"), z.literal("none"), z.literal("only")]);
export type NsfwFilter = z.infer<typeof nsfwFilterSchema>;

export const subredditSchema = z.object({
  data: z.object({
    display_name: z.string(),
    quarantine: z.boolean(),
    over18: z.boolean(),
  }),
});

export type SubredditApiResponse = z.infer<typeof subredditSchema>;
export type Subreddit = SubredditApiResponse["data"];

export const listingSchema = z.object({
  data: z.object({
    children: z.array(
      z.object({
        data: z.object({
          subreddit_name_prefixed: z.string(),
          title: z.string(),
          url: z.string(),
          permalink: z.string(),
          over_18: z.boolean(),
          post_hint: z.string().optional(),
          is_gallery: z.boolean().optional(),
          gallery_data: z
            .object({
              items: z.array(z.object({ media_id: z.string() })),
            })
            .optional(),
          selftext: z.string().optional(),
          created: z.number(),
          ups: z.number(),
          upvote_ratio: z.number(),
        }),
      }),
    ),
  }),
});

export type ListingApiResponse = z.infer<typeof listingSchema>;
export type Post = ListingApiResponse["data"]["children"][number]["data"];
