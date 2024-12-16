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
  coordinate: [number, number];
}

export function loadLocations(): HistoricalLocation[] {
  const locationParts = LocationsText.replace(/\r\n/g, "\n").split("\n\n");

  return locationParts.map((locationPart) => {
    const [name, period, coordinate] = locationPart.split("\n");
    const [start, end] = period.split(",");
    const [lat, lon] = coordinate.split(",").map(c => c === "present" ? CURRENT_YEAR : parseFloat(c));

    return {
      name,
      type: 'location',
      period: [parseFloat(start), parseFloat(end)],
      coordinate: [lat, lon]
    };
  });
}