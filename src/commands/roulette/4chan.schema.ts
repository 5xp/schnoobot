import { z } from "zod";

export const threadFilterTypeSchema = z.union([z.literal("all"), z.literal("image"), z.literal("video")]);

export type ThreadFilterType = z.infer<typeof threadFilterTypeSchema>;

export const catalogSchema = z.array(
	z.object({
		page: z.number(),
		threads: z.array(
			z.object({
				no: z.number(),
				sub: z.string().optional(),
				com: z.string().optional(),
				replies: z.number(),
				images: z.number(),
			}),
		),
	}),
);

export type CatalogAPIResponse = z.infer<typeof catalogSchema>;
export type CatalogPage = CatalogAPIResponse[number];
export type CatalogThread = CatalogPage["threads"][number];

export const threadSchema = z.object({
	posts: z.array(
		z.object({
			no: z.number(),
			sub: z.string().optional(),
			com: z.string().optional(),
			tim: z.number().optional(),
			filename: z.string().optional(),
			time: z.number(),
			ext: z.string().optional(),
		}),
	),
});

export type ThreadAPIResponse = z.infer<typeof threadSchema>;
export type ThreadPost = ThreadAPIResponse["posts"][number];
