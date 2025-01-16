import { initControls } from './controls';
import { Earth } from './earth/earth';
import { HistoryManager } from './history/history';
import { Timeline, toKYear } from './timeline';

import './index.css';
import { Editor } from './editor';

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
  const timeline = new Timeline(timelineElement, (newYear) => {
    earth.setYear(toKYear(newYear));
    history.setYear(newYear);
  });

  const earth = new Earth(earthElement, earthOverlayElement, toKYear(timeline.getYear()), (coordinate, button) => {
    editor.onClick(coordinate, button);
  });
  await earth.load();

  const editor = new Editor(earth);

  const history = new HistoryManager(earth, timeline, timeline.getYear());

  initControls(history, earth, editor);
}

init().catch(console.error);