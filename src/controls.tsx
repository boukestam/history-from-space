import { render } from "preact";
import { Earth } from "./earth";
import { HistoryManager } from "./history/history";
import { Button } from "./components/button";

const controls = document.getElementById('controls') as HTMLDivElement;

export function initControls(history: HistoryManager, earth: Earth) {
  document.addEventListener('keyup', (event) => {
    if (event.key === "ArrowLeft") {
      history.skipToPreviousEvent();
    } else if (event.key === "ArrowRight") {
      history.skipToNextEvent();
    }
  });

  render(<Controls history={history} earth={earth} />, controls);
}

export function Controls({history, earth}: {history: HistoryManager, earth: Earth}) {
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

      <Button onClick={() => history.skipToPreviousEvent()}>Previous</Button>
      <Button onClick={() => history.skipToNextEvent()}>Next</Button>
    </div>
  );
}