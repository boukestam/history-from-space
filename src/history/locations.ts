import { Historical } from "./history";
import LocationsText from "./locations.txt?raw";
import { CURRENT_YEAR } from "../timeline";

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
}

export function loadLocations(): HistoricalLocation[] {
  const locationParts = LocationsText.replace(/\r\n/g, "\n").split("\n\n");

  const locations: HistoricalLocation[] = [];

  for (const locationPart of locationParts) {
    const lines = locationPart.split("\n");

    const name = lines[0];
    const period = lines[1];
    const [start, end] = period.split(",");

    const coordinateLines = lines.slice(2);

    let coordinates: [number, number][];

    if (coordinateLines.length === 1 && !coordinateLines[0].includes(",")) {
      const locationName = coordinateLines[0];
      coordinates = locations.find(l => l.name === locationName)?.coordinates || [];
    } else {
      coordinates = coordinateLines.map(line =>
        line.split(",").map(c => c === "present" ? CURRENT_YEAR : parseFloat(c)) as [number, number]
      );
    }

    const location: HistoricalLocation = {
      name,
      type: 'location',
      period: [parseFloat(start), parseFloat(end)],
      coordinates: coordinates
    };

    locations.push(location);
  }

  return locations;
}