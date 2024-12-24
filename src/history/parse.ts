import { HistoricalLocation } from "./locations";

export function parseCoordinatesAndInfo(lines: string[], locations: HistoricalLocation[]) {
  const coordinates: ([number, number] | HistoricalLocation)[][] = [[]];

  let infoStarted = false;
  let infoText = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (infoStarted) {
      if (line === '</info>') {
        infoStarted = false;
        continue;
      }

      infoText += line + "\n";
      continue;
    }

    if (line === '<info>') {
      infoStarted = true;
      continue;
    }

    if (line === '-') {
      coordinates.push([]);
      continue;
    }

    const startsWithNumber = line.match(/^[\d-]/);

    let coordinate: [number, number] | HistoricalLocation;

    if (startsWithNumber) {
      coordinate = line.split(",").map(c => parseFloat(c)) as [number, number];
    } else {
      const location = locations.find(l => l.name === line);
      if (!location) {
        throw new Error(`Location not found: ${line}`);
      }
      coordinate = location;
    }

    coordinates[coordinates.length - 1].push(coordinate);
  }

  return {
    coordinates,
    info: infoText.length > 0 ? new DOMParser().parseFromString(`<info>${infoText}</info>`, "text/xml") : undefined
  };
}