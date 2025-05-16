import WikiaScraper from "../scrapers/WikiaScraper";
import { Wiki, supportedWikis } from "../Wiki";
import { z } from "zod";

const autocompleteSchema = z.object({
	query: z.string(),
	ids: z.record(z.number()),
	suggestions: z.array(z.string()),
});

type AutocompleteResponse = z.infer<typeof autocompleteSchema>;

function getAutocompleteUrl(wikiUrl: string, query: string): string {
	return `${wikiUrl}/wikia.php?controller=UnifiedSearchSuggestions&method=getSuggestions&query=${encodeURIComponent(
		query,
	)}&format=json&scope=internal`;
}

async function getAutocompleteParsedResponse(wikiUrl: string, query: string): Promise<AutocompleteResponse> {
	const response = await fetch(getAutocompleteUrl(wikiUrl, query));
	const data = await response.json();
	const safeParsed = autocompleteSchema.safeParse(data);

	if (!safeParsed.success) {
		return {
			query,
			ids: {},
			suggestions: [],
		};
	}

	return safeParsed.data;
}

const wiki: Wiki = {
	name: "Risk of Rain 2",
	url: "https://riskofrain2.fandom.com",
	scraper: new WikiaScraper(),
	color: "#86ddee",

	autocomplete: async query => {
		const parsed = await getAutocompleteParsedResponse(wiki.url, query).catch(error => {
			console.error(error);
			return null;
		});

		if (!parsed) {
			return [];
		}

		const choices = parsed.suggestions.map(suggestion => ({
			name: suggestion,
			value: parsed.ids[suggestion].toString(),
		}));

		return choices;
	},

	transformContentElement: (_, element) => {
		const unwantedElements = element.querySelectorAll(".nomobile");
		unwantedElements.forEach(element => element.remove());
	},

	getImage: (document, element) => {
		const title = document.querySelector("#firstHeading")?.textContent?.trim();
		const image: HTMLImageElement | null = element.querySelector(`img[alt*="${title}"]`);
		return wiki.scraper.getImageUrl(image);
	},
};

supportedWikis.set("ror2", wiki);
