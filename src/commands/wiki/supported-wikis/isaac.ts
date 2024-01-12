import { Wiki, supportedWikis } from "../Wiki";
import { z } from "zod";
import WikiaScraper from "../scrapers/WikiaScraper";

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
  name: "The Binding of Isaac",
  url: "https://bindingofisaacrebirth.fandom.com",
  scraper: new WikiaScraper(),
  color: "#ff2400",

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

  transformContentElement: (document, element) => {
    // Replace the DLC indicators with their text
    const images = element.querySelectorAll("img");
    images.forEach(image => {
      if (image.classList.contains("dlc")) {
        const span = document.createElement("span");
        span.textContent = image.alt;
        image.parentElement?.replaceChild(span, image);
      }
    });
  },

  getImage: (_, element) => {
    const image: HTMLImageElement | null = element.querySelector("aside > div.pi-data img");
    const url = wiki.scraper.getImageUrl(image);

    if (url) {
      return url;
    }

    const galleryImage: HTMLLinkElement | null = element.querySelector(".gallerybox a");
    return galleryImage?.href || null;
  },
};

supportedWikis.set("isaac", wiki);
