import { ColorResolvable } from "discord.js";
import { BaseScraper } from "./scrapers/BaseScraper";

type AutocompleteChoice = {
  name: string;
  value: string;
};

export type Wiki = {
  name: string;
  url: string;
  scraper: BaseScraper;
  color?: ColorResolvable;
  autocomplete: (query: string) => Promise<AutocompleteChoice[]>;
  transformContentElement?: (document: Document, element: Element) => void;
  getImage?: (document: Document, element: Element) => string | null;
};

export const supportedWikis = new Map<string, Wiki>();
