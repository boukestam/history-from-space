import { render } from "preact";
import { Earth } from "./earth/earth";
import { HistoryManager } from "./history/history";
import { Button } from "./components/button";
import { Editor, EditorMode, EditorModes } from "./editor";

const controls = document.getElementById('controls') as HTMLDivElement;

export function initControls(history: HistoryManager, earth: Earth, editor: Editor) {
  document.addEventListener('keyup', (event) => {
    if (event.key === "ArrowLeft") {
      history.skipToPreviousEvent();
    } else if (event.key === "ArrowRight") {
      history.skipToNextEvent();
    }
  });

  render(<Controls history={history} earth={earth} editor={editor} />, controls);
}

export function Controls({history, earth, editor}: {history: HistoryManager, earth: Earth, editor: Editor}) {
  return (
    <div className="flex gap-5 justify-center">
      <select onChange={(e) => {
        earth.setVisualisation(parseInt(e.currentTarget.value));
      }}>
        <option value="0">Earth</option>
        <option value="1">Max temperature</option>
        <option value="2">Min temperature</option>
        <option value="3">Precipitation</option>
      </select>

      <select onChange={(e) => {
        editor.mode = e.currentTarget.value as EditorMode;
      }}>
        {EditorModes.map(mode => (
          <option value={mode}>{mode}</option>
        ))}
      </select>

      <Button onClick={() => history.skipToPreviousEvent()}>Previous</Button>
      <Button onClick={() => history.skipToNextEvent()}>Next</Button>

      <input type="range" min="0" max="1" step="0.01" value={earth.projectionBlend} onInput={(e) => {
        earth.setProjectionBlend(parseFloat(e.currentTarget.value));
      }} />

      <Button onClick={() => earth.toggleBorders()}>Borders</Button>
      <Button onClick={() => earth.toggleRivers()}>Rivers</Button>
      <Button onClick={() => earth.toggleIce()}>Ice</Button>
      <Button onClick={() => earth.toggleItems()}>Items</Button>
    </div>
  );
}