import { Historical } from "./history";
import LocationsText from "./locations.txt?raw";
import { parseCoordinatesAndInfo } from "./parse";

// Example locations.txt file:
/*
Egypt
-3150,-30
30.045534,31.230703

Caral
-2600,-1800
-10.892006,-77.523324
*/

export interface HistoricalLocation extends Historical {
  coordinates: [number, number][];
  info?: Document;
}

export function loadLocations(): HistoricalLocation[] {
  const locationParts = LocationsText.replace(/\r\n/g, "\n").split("\n\n");

  const locations: HistoricalLocation[] = [];

  for (const locationPart of locationParts) {
    const lines = locationPart.split("\n");

    const name = lines[0];
    const period = lines[1];
    const [start, end] = period.split(",");

    const { coordinates, info } = parseCoordinatesAndInfo(lines.slice(2), locations);

    const location: HistoricalLocation = {
      name,
      type: 'location',
      period: [parseFloat(start), parseFloat(end)],
      coordinates: coordinates[0] as [number, number][],
      info
    };

    locations.push(location);
  }

  return locations;
}