import { getAreaColor } from "./earth/earth";
import { HistoricalEvent } from "./history/events";
import { HistoricalLocation } from "./history/locations";

export const CURRENT_YEAR = new Date().getFullYear();
export const MIN_YEAR = -100000;
export const MAX_YEAR = CURRENT_YEAR;

const ZOOM_SPEED = 0.1;
const LOG_SKEW = 0.001;

export function toKYear(year: number) {
  return Math.abs((year - CURRENT_YEAR) / 1000);
}

export class Timeline {

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  size: { width: number, height: number };

  private year: number;
  private minYear: number;
  private maxYear: number;
  private target: number = -1;

  onYearChange: (year: number) => void;

  events: {
    event: HistoricalEvent;
    image: HTMLImageElement;
  }[] = [];

  periods: {
    location: HistoricalLocation;
    color: string;
  }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    onYearChange: (year: number) => void
  ) {
    this.canvas = canvas;
    this.onYearChange = onYearChange;

    this.size = this.resize(canvas);

    window.addEventListener('resize', () => {
      this.size = this.resize(canvas);
      this.render();
    });

    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    this.year = 0;
    this.minYear = MIN_YEAR;
    this.maxYear = MAX_YEAR;

    const data = localStorage.getItem('timeline');
    if (data) {
      const { min, max, year: y } = JSON.parse(data);
      this.minYear = min;
      this.maxYear = max;
      this.year = y;
    }

    this.ctx.textAlign = 'center';
    this.ctx.font = '12px Tahoma';

    this.initControls();

    this.render();
  }

  // Apply a logarithmic transformation to the year
  logTransformYear(year: number) {
    const normalizedYear = this.maxYear - year;
    return Math.log10(normalizedYear * LOG_SKEW + 1);
  }

  // Inverse of the logarithmic transformation
  logInverseTransform(value: number) {
    return this.maxYear - ((Math.pow(10, value) - 1) / LOG_SKEW);
  }

  yearToX(year: number) {
    const logMin = this.logTransformYear(this.minYear);
    const logMax = this.logTransformYear(this.maxYear);
    const logYear = this.logTransformYear(year);

    return Math.round(((logYear - logMin) / (logMax - logMin)) * this.size.width);
  }

  xToYear(x: number) {
    const logMin = this.logTransformYear(this.minYear);
    const logMax = this.logTransformYear(this.maxYear);

    const logYear = x / this.size.width * (logMax - logMin) + logMin;
    return this.logInverseTransform(logYear);
  }

  yearToString(year: number, step: number) {
    let yearString;

    if (year > -10000) {
      yearString = Math.abs(year).toFixed(0);
    } else if (year > -1000000) {
      let decimals = Math.min(3, Math.max(0, 4 - Math.log10(step)));
      yearString = (year / -1000).toFixed(decimals) + "K";
    } else {
      let decimals = Math.min(3, Math.max(0, 7 - Math.log10(step)));
      yearString = (year / -1000000).toFixed(decimals) + "M";
    }

    return yearString + " " + (year < 0 ? "BC" : "AD");
  }

  getStepSize(range: number) {
    if (range > 25000) return 10000;
    if (range > 10000) return 5000;
    if (range > 5000) return 2500;
    if (range > 2500) return 1000;
    if (range > 1000) return 500;
    if (range > 500) return 250;
    if (range > 250) return 100;
    if (range > 100) return 50;
    if (range > 50) return 25;
    if (range > 25) return 10;
    if (range > 10) return 5;
    return 1;
  }

  getSteps(): { year: number, sub: boolean }[] {
    const xStep = this.size.width > 600 ? 150 : 75;

    const steps = [];

    for (let x = -xStep * 2; x < this.size.width; x += 1) {
      let currentYear = this.xToYear(x);
      let nextStepYear = this.xToYear(x + xStep);

      const range = nextStepYear - currentYear;
      const stepSize = this.getStepSize(range);
      const step = Math.ceil(nextStepYear / stepSize) * stepSize;

      steps.push({ year: step, sub: false });

      x = this.yearToX(step);
    }

    // Sub steps
    const substeps = [];

    for (let i = 0; i < steps.length - 1; i++) {
      const step = steps[i];
      const nextStep = steps[i + 1];

      const range = nextStep.year - step.year;

      for (let j = 1; j < 5; j++) {
        const substep = step.year + range * j / 5;
        substeps.push({ year: substep, sub: true });
      }
    }

    return [...steps, ...substeps];
  }

  resize(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    return { width: rect.width, height: rect.height };
  }

  render() {
    this.ctx.save();
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    this.ctx.clearRect(0, 0, this.size.width, this.size.height);

    const steps = this.getSteps();

    for (const step of steps) {
      const x = this.yearToX(step.year);

      if (!step.sub) {
        this.ctx.fillStyle = 'lightgray';
        this.ctx.fillRect(x, 20, 1, 40);
        this.ctx.fillText(this.yearToString(step.year, step.year), x, 13);
      } else {
        this.ctx.fillStyle = 'gray';
        this.ctx.fillRect(x, 20, 1, 20);
      }
    }

    const renderedPeriods = [];

    for (const period of this.periods) {
      if (period.location.period[1] < this.minYear || period.location.period[0] > this.maxYear) continue;

      const x1 = this.yearToX(period.location.period[0]);
      const x2 = this.yearToX(period.location.period[1]);

      // Check for overlapping periods
      const overlap = renderedPeriods.filter(p => p.x1 < x2 && p.x2 > x1).length;

      const height = 4;
      const y = 20 + overlap * height;

      this.ctx.fillStyle = period.color;
      this.ctx.fillRect(x1, y, x2 - x1, height);

      renderedPeriods.push({ x1, x2 });
    }

    for (const marker of this.events) {
      const x = this.yearToX(marker.event.time);

      const markerRadius = 12;
      const markerImageSize = 16;
      const markerY = 30;

      this.ctx.fillStyle = marker.event.icon.color;
      this.ctx.beginPath();
      this.ctx.arc(x, markerY, markerRadius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.drawImage(marker.image, x - markerImageSize / 2, markerY - markerImageSize / 2, markerImageSize, markerImageSize);
    }

    const x = this.yearToX(this.year);
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(x - 1, 20, 3, 40);
    this.ctx.fillText(this.yearToString(this.year, 1), x, 13);

    this.ctx.restore();
  }

  saveView() {
    localStorage.setItem('timeline', JSON.stringify({
      min: this.minYear,
      max: this.maxYear,
      year: this.year
    }));
  }

  onClick(clientX: number) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;

    let newYear = this.xToYear(x);
    newYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, newYear));

    this.onYearChange(newYear);

    this.year = newYear;

    this.saveView();
    this.render();
  }

  onZoom(clientX: number, delta: number, zoomSpeed = ZOOM_SPEED) {
    const x = clientX - this.canvas.getBoundingClientRect().left;

    // Zoom in/out from the cursor
    const zoom = delta > 0 ? (1 + zoomSpeed) : 1 / (1 + zoomSpeed);
    const cursorYear = this.xToYear(x);

    this.minYear = cursorYear - (cursorYear - this.minYear) * zoom;
    this.maxYear = cursorYear + (this.maxYear - cursorYear) * zoom;

    if (this.minYear < MIN_YEAR) {
      this.minYear = MIN_YEAR;
      this.maxYear = Math.min(this.minYear + (this.maxYear - this.minYear) * zoom, MAX_YEAR);
    }

    if (this.maxYear > MAX_YEAR) {
      this.maxYear = MAX_YEAR;
      this.minYear = Math.max(this.maxYear - (this.maxYear - this.minYear) * zoom, MIN_YEAR);
    }

    this.saveView();
    this.render();
  }

  clampPan(range: number) {
    if (this.minYear < MIN_YEAR) {
      this.minYear = MIN_YEAR;
      this.maxYear = this.minYear + range;
    }

    if (this.maxYear > MAX_YEAR) {
      this.maxYear = MAX_YEAR;
      this.minYear = this.maxYear - range;
    }
  }

  onPan(delta: number) {
    const range = this.maxYear - this.minYear;

    const stepSize = range / this.size.width;
    const deltaYear = -delta * stepSize;

    this.minYear += deltaYear;
    this.maxYear += deltaYear;

    this.clampPan(range);

    this.saveView();
    this.render();
  }

  initControls() {
    let moving = false;
    let panning = false;

    // Mouse events

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.onClick(e.clientX);
        moving = true;
      } else if (e.button === 2) {
        panning = true;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (moving) this.onClick(e.clientX);
      if (panning) this.onPan(e.movementX);
    });

    document.addEventListener('mouseup', () => {
      moving = false;
      panning = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      this.onZoom(e.clientX, e.deltaY > 0 ? 1 : -1);
    });

    // Touch events

    let scaling = false;
    let lastTouchDistance = 0;
    let lastTouchCenterX = 0;

    function getTouchDistance(e: TouchEvent) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      return Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
    }

    function getTouchCenterX(e: TouchEvent) {
      return (e.touches[0].clientX + e.touches[1].clientX) / 2;
    }

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.onClick(e.touches[0].clientX);
        moving = true;
        scaling = false;
      } else if (e.touches.length === 2) {
        lastTouchDistance = getTouchDistance(e);
        lastTouchCenterX = getTouchCenterX(e);
        scaling = true;
        moving = false;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (moving) this.onClick(e.touches[0].clientX);

      if (scaling && e.touches.length === 2) {
        const touchDistance = getTouchDistance(e);
        const touchCenterX = getTouchCenterX(e);

        this.onPan(touchCenterX - lastTouchCenterX);
        this.onZoom(touchCenterX, (touchDistance > lastTouchDistance ? -1 : 1), 0.05);

        lastTouchDistance = touchDistance;
        lastTouchCenterX = touchCenterX;
      }
    });

    document.addEventListener('touchend', () => {
      moving = false;
      scaling = false;
    });

    this.canvas.addEventListener('touchcancel', () => {
      moving = false;
      scaling = false;
    });
  }

  update() {
    if (this.target === -1) return;

    const delta = this.target - this.year;
    const step = delta * 0.1;

    if (Math.abs(step) < 0.1) {
      this.year = this.target;
      this.target = -1;
    } else {
      this.year += step;
      this.minYear += step;
      this.maxYear += step;

      this.clampPan(this.maxYear - this.minYear);
    }

    this.onYearChange(this.year);

    this.saveView();
    this.render();

    setTimeout(() => this.update(), 1000 / 30);
  }

  getYear() {
    return this.target === -1 ? this.year : this.target;
  }

  setYear(newYear: number) {
    this.year = newYear;

    // Move min max to center on year
    const range = this.maxYear - this.minYear;
    this.minYear = this.year - range / 2;
    this.maxYear = this.year + range / 2;
    this.clampPan(range);

    this.onYearChange(newYear);

    this.saveView();
    this.render();
  }

  addEvent(event: HistoricalEvent) {
    const img = new Image();
    img.src = event.icon.url;

    this.events.push({
      event,
      image: img,
    });

    img.onload = () => {
      this.render();
    };
  }

  addPeriod(location: HistoricalLocation) {
    const colorVec = getAreaColor(location.name);
    const color = `rgb(${Math.round(colorVec.x * 255)}, ${Math.round(colorVec.y * 255)}, ${Math.round(colorVec.z * 255)})`;

    this.periods.push({ location, color });
    this.render();
  }

  setTarget(newTarget: number) {
    this.target = newTarget;
    this.update();
  }
}