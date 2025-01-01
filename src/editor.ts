import { isCoordinateInArea } from "./util/coordinate";
import { Earth, EarthArea, EarthItem } from "./earth/earth";

export type EditorMode = "none" | "arrow" | "area" | "edit";

export const EditorModes = ["none", "arrow", "area", "edit"];

export class Editor {
  mode: EditorMode = "none";

  earth: Earth;

  coordinates: [number, number][] = [];
  index: number = -1;
  name: string = '';
  shape?: EarthItem;
  originalArea?: EarthArea;

  constructor(earth: Earth) {
    this.earth = earth;

    document.addEventListener('keyup', (event) => {
      if (event.key === 'Delete') {
        this.coordinates.length = 0;

        if (this.shape) {
          this.shape.remove();
          this.shape = undefined;
        }
      } else if (event.key === 'Backspace') {
        if (this.coordinates.length > 0) {
          this.coordinates.splice(this.index, 1);

          this.index--;
          if (this.index < 0) this.index = 0;
          if (this.index >= this.coordinates.length) this.index = this.coordinates.length - 1;

          this.updateShape();
        }
      } else if (event.key === 'Escape') {
        if (this.mode === 'area') {
          this.mode = 'edit';
          this.coordinates = [];
          this.index = -1;
          this.name = '';

          this.shape?.remove();
          this.shape = undefined;

          if (this.originalArea) {
            this.earth.addArea(this.originalArea.coordinates, this.originalArea.label?.element.innerText || '');
            this.originalArea = undefined;
          }
        }
      }
    });
  }

  onClick(coordinate: [number, number], button: number) {
    if (this.mode === 'none') return;

    if (this.mode === 'edit') {
      const area = this.earth.areas.find(area => isCoordinateInArea(coordinate, area.coordinates));

      if (area) {
        this.coordinates = area.coordinates;
        this.index = area.coordinates.length - 1;
        this.mode = 'area';
        this.name = area.label?.element.innerText || '';
        this.shape = area;
        this.originalArea = area;
      }
    } else {
      if (button === 0) {
        this.coordinates.splice(this.index + 1, 0, coordinate);
        this.index++;
      } else if (button === 2) {
        // Find the closest coordinate
        let closestIndex = 0;
        let closestDistance = Infinity;

        for (let i = 0; i < this.coordinates.length; i++) {
          const distance = Math.hypot(
            this.coordinates[i][0] - coordinate[0],
            this.coordinates[i][1] - coordinate[1]
          );

          if (distance < closestDistance) {
            closestIndex = i;
            closestDistance = distance;
          }
        }

        this.index = closestIndex;
      }
    }

    this.updateShape();
  }

  updateShape() {
    console.log(this.coordinates.map(coordinate =>
      `${coordinate[0].toFixed(2)},${coordinate[1].toFixed(2)}`
    ).join('\n'));

    if (this.shape) {
      this.shape.remove();
      this.shape = undefined;
    }

    if (this.coordinates.length >= 2) {
      if (this.mode === 'arrow') {
        this.shape = this.earth.addArrow(this.coordinates, this.name);
      } else if (this.mode === 'area') {
        this.shape = this.earth.addArea(this.coordinates, this.name, undefined, { index: this.index });
      }
    }
  }
}