import { EarthItem, initEarth } from './earth';
import { initHistory } from './history/history';
import './index.css';
import { initTimeline, toKYear } from './timeline';

const earthWrapperElement = document.getElementById('earth-wrapper') as HTMLDivElement;
const earthElement = document.getElementById('earth') as HTMLDivElement;

function resizeEarthElement() {
  const bounds = earthWrapperElement.getBoundingClientRect();
  //const size = Math.min(bounds.width, bounds.height);

  earthElement.style.width = `${bounds.width}px`;
  earthElement.style.height = `${bounds.height}px`;
}

resizeEarthElement();

window.addEventListener('resize', resizeEarthElement);

const timelineElement = document.getElementById('timeline') as HTMLCanvasElement;
const visualisationElement = document.getElementById('visualisation') as HTMLSelectElement;

async function init() {
  const timeline = await initTimeline(timelineElement, (newYear) => {
    earth.setYear(toKYear(newYear));
    history.setYear(newYear);
  });

  const coordinates: [number, number][] = [];
  let arrow: EarthItem | undefined;

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      coordinates.length = 0;
      if (arrow) {
        arrow.remove();
        arrow = undefined;
      }
    } else if (event.key === "ArrowLeft") {
      history.skipToPreviousEvent();
    } else if (event.key === "ArrowRight") {
      history.skipToNextEvent();
    }
  });

  const earth = await initEarth(earthElement, toKYear(timeline.year()), (coordinate, button) => {
    if (button === 0) {
      coordinates.push(coordinate);
    } else if (button === 2) {
      coordinates.pop();
    }

    console.log(coordinates.map(coordinate => 
      `${coordinate[0].toFixed(2)},${coordinate[1].toFixed(2)}`
    ).join('\n'));

    if (arrow) {
      arrow.remove();
      arrow = undefined;
    }

    if (coordinates.length >= 2) {
      arrow = earth.addArrow(coordinates, 'New arrow');
    }
  });

  visualisationElement.addEventListener('change', () => {
    const value = visualisationElement.value;
    earth.setVisualisation(parseInt(value));
  });

  const history = await initHistory(earth, timeline, timeline.year());
}

init().catch(console.error);