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
  // getPages(sections: string[]): string[] {
  //   let pages = [];
  //   let currentPage = "";
  //   let remainingSection = "";

  //   this.sections.forEach(section => {
  //     // If there's a remaining section from the previous iteration, prepend it
  //     if (remainingSection) {
  //       section = remainingSection + section;
  //       remainingSection = "";
  //     }

  //     // If the current page with the new section exceeds the character limit
  //     if (`${currentPage}\n${section}`.length > this.charactersPerPage) {
  //       // We can't fit a single section on a page, so we need to split it up
  //       if (currentPage === "") {
  //         currentPage = section;

  // while (currentPage.length > this.charactersPerPage) {
  //   let lastCompleteWordIndex = this.charactersPerPage;
  //   while (currentPage.charAt(lastCompleteWordIndex) !== " " && lastCompleteWordIndex > 0) {
  //     lastCompleteWordIndex--;
  //   }

  //   // If no complete word can fit, take as many characters as possible
  //   if (lastCompleteWordIndex === 0) {
  //     lastCompleteWordIndex = this.charactersPerPage;
  //   }

  //   // Add the part that fits to the current page, and the rest to the remaining section
  //   pages.push(currentPage.substring(0, lastCompleteWordIndex).trim());
  //   currentPage = currentPage.substring(lastCompleteWordIndex);
  //         }
  //       } else {
  //         // We can't fit the next section on the current page
  //         remainingSection = section;
  //       }

  //       // Add the current page to the pages array and start a new page
  //       pages.push(currentPage.trim());
  //       currentPage = "";
  //     } else {
  //       // If the current page with the new section doesn't exceed the character limit, add the section to the current page
  //       currentPage += `\n${section}`;
  //     }
  //   });

  //   // If there's a remaining section or a current page after iterating over all sections, add it to the pages array
  //   if (currentPage || remainingSection) {
  //     pages.push((currentPage + remainingSection).trim());
  //   }

  //   for (let i = 0; i < pages.length; i++) {
  //     if (pages[i].length > this.charactersPerPage) {
  //       console.error(`Page ${i} exceeded the character limit from ${this.url}`);
  //       pages[i] = pages[i].substring(0, this.charactersPerPage);
  //     }
  //   }

  //   return pages;
  // }
}
