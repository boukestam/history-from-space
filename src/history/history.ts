import { Earth, EarthItem } from "../earth/earth";
import { HistoricalEvent, loadEvents } from "./events";
import { HistoricalLocation, loadLocations } from "./locations";
import { Timeline } from "../timeline";
import { loadIcons } from "./icons";
import { getCoordinateCenter } from "../util/coordinate";

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

function getTime(item: Historical) {
  if (item.type === 'location') {
    return (item as HistoricalLocation).period[0];
  } else {
    return (item as HistoricalEvent).time;
  }
}

function getItemCenter(item: Historical) {
  if (item.type === 'location') {
    return getCoordinateCenter((item as HistoricalLocation).coordinates);
  } else {
    return getEventCenter(item as HistoricalEvent);
  }
}

export class HistoryManager {

  private earth: Earth;
  private timeline: Timeline;

  private items: Historical[] = [];

  constructor(earth: Earth, timeline: Timeline, initialYear: number) {
    this.earth = earth;
    this.timeline = timeline;

    const icons = loadIcons();
    const locations = loadLocations();
    const events = loadEvents(locations, icons);

    this.items = [...locations, ...events].sort((a, b) => a.period[0] - b.period[0]);

    for (const event of events) {
      timeline.addEvent(event);
    }

    for (const location of locations) {
      timeline.addPeriod(location);
    }

    this.updateMap(initialYear);
  }

  updateMap(year: number) {
    for (const item of this.items) {
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
            location.removable = this.earth.addMarker(location.coordinates[0], location.name, location.info);
          } else {
            location.removable = this.earth.addArea(location.coordinates, location.name, location.info);
          }
        } else if (item.type === 'event') {
          const event = item as HistoricalEvent;

          if (event.eventType === 'arrow') {
            const arrows = getEventCoordinates(event).map((coordinates, i) => this.earth.addArrow(
              coordinates,
              i === 0 ? event.name : "",
              i === 0 ? event.info : undefined
            ));
            event.removable = { remove: () => arrows.forEach(arrow => arrow.remove()) };
          } else if (event.eventType === 'marker') {
            event.removable = this.earth.addMarker(getEventCenter(event), event.name, event.info);
          }
        }
      }
    }
  }

  setYear(year: number) {
    this.updateMap(year);
  }

  skipToPreviousEvent() {
    const currentYear = this.timeline.getYear();
    const previous = this.items.slice()
      .sort((a, b) => getTime(b) - getTime(a))
      .find(item => getTime(item) < currentYear);

    if (previous) {
      this.timeline.setTarget(getTime(previous));
      this.earth.setTarget(getItemCenter(previous));
    }
  }

  skipToNextEvent() {
    const currentYear = this.timeline.getYear();
    const next = this.items.slice()
      .sort((a, b) => getTime(a) - getTime(b))
      .find(item => getTime(item) > currentYear);

    if (next) {
      this.timeline.setTarget(getTime(next));
      this.earth.setTarget(getItemCenter(next));
    }
  }
}