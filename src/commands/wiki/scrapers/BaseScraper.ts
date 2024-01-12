import TurndownService from "turndown";

export const turndownService = new TurndownService({
  headingStyle: "atx",
});

turndownService.addRule("latex", {
  filter: node => node.classList.contains("mwe-math-element"),
  replacement: (_, node) => {
    const mathElement = node.querySelector("math");

    return mathElement?.getAttribute("alttext") || "";
  },
});

export type Content = {
  title: string | null;
  contentElement: Element | null;
  image: string | null;
};

export abstract class BaseScraper {
  abstract getPageUrl(wikiUrl: string, pageId: string): Promise<string>;

  abstract getPageDOM(pageUrl: string): Promise<Document>;

  abstract getContentElement(document: Document): Element | null;

  abstract getTitle(document: Document): string | null;

  abstract getContent(
    baseUrl: string,
    pageUrl: string,
    transformContentElement?: (document: Document, element: Element) => void,
    getImage?: (document: Document, element: Element) => string | null,
  ): Promise<Content>;

  abstract stripUnwantedElements(element: Element): void;

  splitIntoSections(element: Element): string[] {
    const children = Array.from(element.children);
    let sections: string[] = [];
    let currentSection = "";

    children.forEach((child, i) => {
      if (child.nodeName === "H1" || child.nodeName === "H2" || child.nodeName === "H3") {
        if (currentSection !== "") {
          sections.push(currentSection);
        }
        currentSection = child.outerHTML;
      } else {
        currentSection += child.outerHTML;
      }

      if (i === children.length - 1) {
        sections.push(currentSection);
      }
    });

    return sections;
  }

  getMarkdown(html: string): string {
    return turndownService.turndown(html.trim());
  }

  replaceRelativeHrefs(baseUrl: string, element: Element) {
    const elements = element.querySelectorAll("a[href^='/']");
    elements.forEach(el => {
      el.setAttribute("href", `${baseUrl}${el.getAttribute("href")}`);
    });
  }

  removeElement(element: Element, selector: string) {
    const elements = element.querySelectorAll(selector);
    elements.forEach(element => element.remove());
  }

  removeSingleHeaders(element: Element) {
    const headers = element.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headers.forEach(el => {
      const nextElement = el.nextElementSibling;
      if (!nextElement || nextElement.tagName.toLowerCase().startsWith("h")) {
        el.remove();
      }
    });
  }

  removeEmptyElements(element: Element, selector: string) {
    const elements = element.querySelectorAll(selector);
    elements.forEach(element => {
      const text = element.textContent;
      if (!text || text.trim() === "") {
        element.remove();
      }
    });
  }

  getImageUrl(element: HTMLImageElement | null): string | null {
    return element?.getAttribute("data-src") || element?.src || null;
  }
}
