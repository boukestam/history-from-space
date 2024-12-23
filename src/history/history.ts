import { Earth, EarthItem } from "../earth";
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
  removable?: EarthItem;
}

function getEventCenter(event: HistoricalEvent) {
  const coordinates: [number, number][] = [];

  for (const c of event.coordinates.flat()) {
    if (Array.isArray(c)) {
      coordinates.push(c);
    } else {
      coordinates.push(...c.coordinates);
    }
  }

  return getCoordinateCenter(coordinates);
}

function getEventCoordinates(event: HistoricalEvent): [number, number][][] {
  return event.coordinates.map(coordinates =>
    coordinates.map(c => Array.isArray(c) ? c : getCoordinateCenter(c.coordinates))
  );
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
            const arrows = getEventCoordinates(event).map((coordinates, i) => earth.addArrow(coordinates, i === 0 ? event.name : ""));
            event.removable = { remove: () => arrows.forEach(arrow => arrow.remove()) };
          } else if (event.eventType === 'marker') {
            event.removable = earth.addMarker(getEventCenter(event), event.name);
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
        earth.setTarget(getEventCenter(previousEvent));
      }
    },

    skipToNextEvent: () => {
      const currentYear = timeline.year();
      const nextEvent = events.slice()
        .sort((a, b) => a.time - b.time)
        .find(event => event.time > currentYear);

      if (nextEvent) {
        timeline.setTarget(nextEvent.time);
        earth.setTarget(getEventCenter(nextEvent));
      }
    }
  };
}

export type HistoryManager = Awaited<ReturnType<typeof initHistory>>;