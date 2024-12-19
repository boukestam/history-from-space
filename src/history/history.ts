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
  const icons = loadIcons();
  const locations = loadLocations();
  const events = loadEvents(locations, icons);

  const items = [...locations, ...events].sort((a, b) => a.period[0] - b.period[0]);

  for (const event of events) {
    timeline.addEvent(event);
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

          if (location.coordinates.length === 1) {
            location.removable = earth.addMarker(location.coordinates[0], location.name);
          } else {
            location.removable = earth.addArea(location.coordinates, location.name);
          }
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
        .sort((a, b) => b.time - a.time)
        .find(event => event.time < currentYear);

      if (previousEvent) {
        timeline.setTarget(previousEvent.time);
        earth.setTarget(getCoordinateCenter(previousEvent.coordinates[0]));
      }
    },

    skipToNextEvent: () => {
      const currentYear = timeline.year();
      const nextEvent = events.slice()
        .sort((a, b) => a.time - b.time)
        .find(event => event.time > currentYear);

      if (nextEvent) {
        timeline.setTarget(nextEvent.time);
        earth.setTarget(getCoordinateCenter(nextEvent.coordinates[0]));
      }
    }
  };
}

export type HistoryManager = Awaited<ReturnType<typeof initHistory>>;