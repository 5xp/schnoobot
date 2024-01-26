import { ColorResolvable } from "discord.js";

export default class Paginator {
  url: string;
  title: string;
  sections: string[];
  currentPage: number;
  maxPageLength = 4096;
  pages: string[];
  color: ColorResolvable = "#2b2b31";
  image?: string;

  constructor(url: string, title: string, sections: string[], image?: string) {
    this.url = url;
    this.title = title;
    this.sections = sections;
    this.currentPage = 0;
    this.image = image;
    this.pages = this.getPages(sections);
  }

  /**
   * Try to fit as many sections as we can into one page without interrupting a section.
   * Only interrupts a section if it's the first section of the page.
   * @param sections array of strings, where the length of each may or may not be greater than allowed
   * @returns an array of strings, where the length of each string is within the threshold
   */
  getPages(sections: string[]): string[] {
    let pages: string[] = [];
    let currentPage = "";
    let currentSectionIndex = 0;

    while (currentSectionIndex < this.sections.length) {
      const section = sections[currentSectionIndex];

      if (`${currentPage}\n${section}`.length <= this.maxPageLength) {
        currentPage += `\n${section}`;
        currentSectionIndex++;
        continue;
      }

      // First section of the page couldn't fit, so try to fit as many words as possible
      if (currentPage === "") {
        currentPage = section;

        while (currentPage.length > this.maxPageLength) {
          const lastLineBreak = currentPage.lastIndexOf("\n", this.maxPageLength);
          const lastSpace = currentPage.lastIndexOf(" ", this.maxPageLength);

          // prioritize last line break, then last space, then just take as many characters as possible
          let splitAt = this.maxPageLength;

          if (lastLineBreak > 0) {
            splitAt = lastLineBreak;
          } else if (lastSpace > 0) {
            splitAt = lastSpace;
          }

          pages.push(currentPage.substring(0, splitAt));
          currentPage = currentPage.substring(splitAt);
        }

        currentSectionIndex++;
        continue;
      }

      // Can't fit this section onto this page, so start a new page and loop
      pages.push(currentPage);
      currentPage = "";
    }

    if (currentPage) {
      pages.push(currentPage);
    }

    return pages;
  }
}
