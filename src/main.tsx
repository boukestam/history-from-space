import { initControls } from './controls';
import { Earth, EarthItem } from './earth';
import { initHistory } from './history/history';
import { initTimeline, toKYear } from './timeline';

import './index.css';

const earthWrapperElement = document.getElementById('earth-wrapper') as HTMLDivElement;
const earthOverlayElement = document.getElementById('earth-overlay') as HTMLDivElement;
const earthElement = document.getElementById('earth') as HTMLDivElement;
const timelineElement = document.getElementById('timeline') as HTMLCanvasElement;

function resizeEarthElement() {
  const bounds = earthWrapperElement.getBoundingClientRect();
  //const size = Math.min(bounds.width, bounds.height);

  earthElement.style.width = `${bounds.width}px`;
  earthElement.style.height = `${bounds.height}px`;
}

resizeEarthElement();

window.addEventListener('resize', resizeEarthElement);

async function init() {
  const timeline = await initTimeline(timelineElement, (newYear) => {
    earth.setYear(toKYear(newYear));
    history.setYear(newYear);
  });

  const coordinates: [number, number][] = [];
  let shape: EarthItem | undefined;

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      coordinates.length = 0;
      if (shape) {
        shape.remove();
        shape = undefined;
      }
    }
  });

  const earth = new Earth(earthElement, earthOverlayElement, toKYear(timeline.year()), (coordinate, button) => {
    if (button === 0) {
      coordinates.push(coordinate);
    } else if (button === 2) {
      coordinates.pop();
    }

    console.log(coordinates.map(coordinate => 
      `${coordinate[0].toFixed(2)},${coordinate[1].toFixed(2)}`
    ).join('\n'));

    if (shape) {
      shape.remove();
      shape = undefined;
    }

    if (coordinates.length >= 2) {
      //shape = earth.addArrow(coordinates, 'New arrow');
      shape = earth.addArea(coordinates, 'New area', true);
    }
  });

  await earth.load();

  const history = await initHistory(earth, timeline, timeline.year());

  initControls(history, earth);
}

init().catch(console.error);