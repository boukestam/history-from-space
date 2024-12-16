import { Earth } from "../earth";
import { HistoricalEvent, loadEvents } from "./events";
import { HistoricalLocation, loadLocations } from "./locations";
import { Timeline } from "../timeline";
import { loadIcons } from "./icons";
import { getCoordinateCenter } from "../coordinate";

export type HistoricalType = 'location' | 'event';

export interface Historical {
  name: string;
  type: HistoricalType;
  period: [number, number];
  removable?: { remove: () => void };
}

export async function initHistory(earth: Earth, timeline: Timeline, initialYear: number) {
  const locations = loadLocations();
  const events = loadEvents(locations);
  const icons = loadIcons();

  const items = [...locations, ...events].sort((a, b) => a.period[0] - b.period[0]);

  for (const event of events) {
    const icon = icons.find(icon => icon.name === event.icon);
    if (!icon) throw new Error(`Icon not found: ${event.icon}`);

    timeline.addMarker((event.period[0] + event.period[1]) / 2, event.name, icon.color, icon.url);
  }

  function updateMap(year: number) {
    for (const item of items) {
      if (item.period[0] > year || item.period[1] < year) {
        if (item.removable) {
          item.removable.remove();
          delete item.removable;
        }
      } else {
        if (item.removable) continue;

        if (item.type === 'location') {
          const location = item as HistoricalLocation;
          location.removable = earth.addMarker(location.coordinate, location.name);
        } else if (item.type === 'event') {
          const event = item as HistoricalEvent;

          if (event.eventType === 'arrow') {
            const arrows = event.coordinates.map((coordinates, i) => earth.addArrow(coordinates, i === 0 ? event.name : ""));
            event.removable = { remove: () => arrows.forEach(arrow => arrow.remove()) };
          } else if (event.eventType === 'marker') {
            event.removable = earth.addMarker(event.coordinates[0][0], event.name);
          }
        }
      }
    }
  }

  updateMap(initialYear);

  return {
    setYear: (year: number) => {
      updateMap(year);
    },

    skipToPreviousEvent: () => {
      const currentYear = timeline.year();
      const previousEvent = events.slice()
        .sort((a, b) => b.period[1] - a.period[1])
        .find(event => event.period[1] < currentYear);

      if (previousEvent) {
        timeline.setYear((previousEvent.period[0] + previousEvent.period[1]) / 2);
        earth.setTarget(getCoordinateCenter(previousEvent.coordinates[0]));
      }
    },

    skipToNextEvent: () => {
      const currentYear = timeline.year();
      const nextEvent = events.slice()
        .sort((a, b) => a.period[0] - b.period[0])
        .find(event => event.period[0] > currentYear);

      if (nextEvent) {
        timeline.setYear((nextEvent.period[0] + nextEvent.period[1]) / 2);
        earth.setTarget(getCoordinateCenter(nextEvent.coordinates[0]));
      }
    }
  };
}