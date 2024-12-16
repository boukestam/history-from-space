import IconsText from "./icons.txt?raw";

// Example icons.txt file:
/*
Tool
/Tool.svg
#FFEABB

Sphinx
/Sphinx.svg
#EDDCCF
*/

export interface Icon {
  name: string;
  url: string;
  color: string;
}

export function loadIcons(): Icon[] {
  const iconParts = IconsText.replace(/\r\n/g, "\n").split("\n\n");

  return iconParts.map((iconPart) => {
    const lines = iconPart.split("\n");

    const [name, url, color] = lines;

    return { name, url, color };
  });
}