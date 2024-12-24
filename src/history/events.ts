import { Historical } from "./history";
import EventsText from "./events.txt?raw";
import { HistoricalLocation } from "./locations";
import { CURRENT_YEAR } from "../timeline";
import { Icon } from "./icons";
import { parseCoordinatesAndInfo } from "./parse";

export type HistoricalEventType = 'arrow' | 'marker';

export interface HistoricalEvent extends Historical {
  icon: Icon;
  time: number;
  eventType: HistoricalEventType;
  coordinates: ([number, number] | HistoricalLocation)[][];
  info?: Document;
}

export function loadEvents(locations: HistoricalLocation[], icons: Icon[]): HistoricalEvent[] {
  const eventParts = EventsText.replace(/\r\n/g, "\n").split("\n\n");

  return eventParts.map((eventPart) => {
    const lines = eventPart.split("\n");

    const [name, time, icon, type] = lines.slice(0, 4);

    const { coordinates, info } = parseCoordinatesAndInfo(lines.slice(4), locations);

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
      coordinates,
      info
    };

    return event;
  });
}