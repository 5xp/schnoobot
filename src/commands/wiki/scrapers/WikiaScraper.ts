import { z } from "zod";
import jsdom from "jsdom";
const { JSDOM } = jsdom;
import { BaseScraper, Content } from "./BaseScraper";

const pageUrlSchema = z.object({
	query: z.object({
		pages: z.array(
			z.object({
				fullurl: z.string(),
			}),
		),
	}),
});

export default class WikiaScraper extends BaseScraper {
	async getPageUrl(wikiUrl: string, pageId: string): Promise<string> {
		const url = `${wikiUrl}/api.php?action=query&prop=info&pageids=${pageId}&inprop=url&format=json&formatversion=2`;
		const response = await fetch(url);
		const data = await response.json();
		const parsed = pageUrlSchema.safeParse(data);

		if (!parsed.success) {
			return "";
		}

		return parsed.data.query.pages[0].fullurl;
	}

	async getPageDOM(pageUrl: string): Promise<Document> {
		const response = await fetch(pageUrl);
		const data = await response.text();
		const { document } = new JSDOM(data, {
			url: pageUrl,
		}).window;

		return document;
	}

	getContentElement(document: Document): Element | null {
		return document.querySelector(".mw-parser-output");
	}

	getTitle(document: Document): string | null {
		return document.querySelector("#firstHeading")?.textContent?.trim() || null;
	}

	async getContent(
		baseUrl: string,
		pageUrl: string,
		transformContentElement?: (document: Document, element: Element) => void,
		getImage?: (document: Document, element: Element) => string | null,
	): Promise<Content> {
		const document = await this.getPageDOM(pageUrl);
		const contentElement = this.getContentElement(document);
		const title = this.getTitle(document);

		if (!contentElement || !title) {
			return { title: null, contentElement: null, image: null };
		}

		const image = getImage?.(document, contentElement) || null;

		transformContentElement?.(document, contentElement);

		this.replaceRelativeHrefs(baseUrl, contentElement);

		return { title, contentElement, image };
	}

	stripUnwantedElements(element: Element): void {
		this.removeEmptyElements(element, "p, a, ul, ol, li");
		this.removeElement(
			element,
			"table, aside, img, script, svg, .mw-editsection, .gallery, .nav-start, .reference, .toc, .mw-parser-output > div",
		);
		this.removeSingleHeaders(element);
	}
}
