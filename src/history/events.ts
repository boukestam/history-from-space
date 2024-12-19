import { Historical } from "./history";
import EventsText from "./events.txt?raw";
import { HistoricalLocation } from "./locations";
import { CURRENT_YEAR } from "../timeline";
import { Icon } from "./icons";
import { getCoordinateCenter } from "../coordinate";

// Example events.txt file:
/*
Migration out\nof Africa
-80000,-70000
Tool
arrow
27.90682648259639,30.259415982954167
31.261324803096567,37.01628312893661
37.00387673516888,37.74032661052947
40.26846598789029,27.884102354884686
47.09567140752602,18.271253441358088

Unification of Egypt
-3200,-3100
Sphinx
marker
Egypt
*/

export type HistoricalEventType = 'arrow' | 'marker';

export interface HistoricalEvent extends Historical {
  icon: Icon;
  time: number;
  eventType: HistoricalEventType;
  coordinates: [number, number][][];
}

export function loadEvents(locations: HistoricalLocation[], icons: Icon[]): HistoricalEvent[] {
  const eventParts = EventsText.replace(/\r\n/g, "\n").split("\n\n");

  return eventParts.map((eventPart) => {
    const lines = eventPart.split("\n");

    const [name, time, icon, type] = lines.slice(0, 4);

    const coordinates: [number, number][][] = [[]];

    for (let i = 4; i < lines.length; i++) {
      const line = lines[i];

      if (line === '-') {
        coordinates.push([]);
        continue;
      }

      const startsWithNumber = line.match(/^[\d-]/);

      let coordinate: [number, number];

      if (startsWithNumber) {
        coordinate = line.split(",").map(c => c === "present" ? CURRENT_YEAR : parseFloat(c)) as [number, number];
      } else {
        const location = locations.find(l => l.name === line);
        if (!location) {
          throw new Error(`Location not found: ${line}`);
        }
        coordinate = getCoordinateCenter(location.coordinates);
      }

      coordinates[coordinates.length - 1].push(coordinate);
    }

    const timeFloat = parseFloat(time);
    const inPast = CURRENT_YEAR - timeFloat;
    const margin = inPast * 0.1;
    const start = timeFloat - margin;
    const end = timeFloat + margin;

    const event: HistoricalEvent = {
      name: name.replace("\\n", "\n"),
      type: 'event',
      time: timeFloat,
      period: [start, end],
      icon: icons.find(i => i.name === icon) as Icon,
      eventType: type as 'arrow' | 'marker',
      coordinates
    };

    return event;
  });
}