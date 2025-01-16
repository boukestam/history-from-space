import { Historical } from "./history";
import { parseCoordinatesAndInfo } from "./parse";

import MiddleEast from "./locations/middle-east.txt?raw";
import Asia from "./locations/asia.txt?raw";
import Europe from "./locations/europe.txt?raw";
import Oceania from "./locations/oceania.txt?raw";
import Africa from "./locations/africa.txt?raw";
import Americas from "./locations/americas.txt?raw";

export type Region = 'Middle East' | 'Asia' | 'Europe' | 'Oceania' | 'Africa' | 'Americas';

export interface HistoricalLocation extends Historical {
  region: Region;
  coordinates: [number, number][];
  info?: Document;
}

function loadLocationsFile(text: string, region: Region): HistoricalLocation[] {
  const locationParts = text.replace(/\r\n/g, "\n").split("\n\n").filter(s => s.trim().length > 0);

  const locations: HistoricalLocation[] = [];

  for (const locationPart of locationParts) {
    try {
      const lines = locationPart.split("\n");

      const name = lines[0];
      const period = lines[1];
      const [start, end] = period.split(",");

      const { coordinates, info } = parseCoordinatesAndInfo(lines.slice(2), locations);

      const location: HistoricalLocation = {
        name,
        type: 'location',
        region,
        period: [parseFloat(start), parseFloat(end)],
        coordinates: coordinates[0] as [number, number][],
        info
      };

      locations.push(location);
    } catch (e) {
      console.error(`Error parsing location: ${locationPart} in ${region}`);
      console.error(e);
    }
  }

  return locations;
}

export function loadLocations(): HistoricalLocation[] {
  return [
    ...loadLocationsFile(MiddleEast, 'Middle East'),
    ...loadLocationsFile(Asia, 'Asia'),
    ...loadLocationsFile(Europe, 'Europe'),
    ...loadLocationsFile(Oceania, 'Oceania'),
    ...loadLocationsFile(Africa, 'Africa'),
    ...loadLocationsFile(Americas, 'Americas')
  ];
}