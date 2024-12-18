export const CURRENT_YEAR = new Date().getFullYear();
export const MIN_YEAR = -100000;
export const MAX_YEAR = CURRENT_YEAR;

const ZOOM_SPEED = 0.1;

export function toKYear(year: number) {
  return Math.abs((year - CURRENT_YEAR) / 1000);
}

function yearToString(year: number, step: number) {
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

function yearToX(year: number, minYear: number, maxYear: number, width: number) {
  return Math.round((year - minYear) / (maxYear - minYear) * width);
}

function xToYear(x: number, minYear: number, maxYear: number, width: number) {
  return x / width * (maxYear - minYear) + minYear;
}

function getStepSize(minYear: number, maxYear: number) {
  const range = maxYear - minYear;

  if (range < 100) return 10;
  if (range < 500) return 50;
  if (range < 1000) return 100;
  if (range < 5000) return 500;
  if (range < 10000) return 1000;
  if (range < 50000) return 5000;
  if (range < 100000) return 10000;
  if (range < 500000) return 50000;
  if (range < 1000000) return 100000;
  if (range < 5000000) return 500000;

  return 1000000;
}

function resize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  return { width: rect.width, height: rect.height };
}

export async function initTimeline(
  canvas: HTMLCanvasElement,
  onYearChange: (year: number) => void
) {
  let size = resize(canvas);

  window.addEventListener('resize', () => {
    size = resize(canvas);
    render();
  });

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  let year = 0;
  let minYear = MIN_YEAR;
  let maxYear = MAX_YEAR;

  const data = localStorage.getItem('timeline');
  if (data) {
    const { min, max, year: y } = JSON.parse(data);
    minYear = min;
    maxYear = max;
    year = y;
  }

  ctx.textAlign = 'center';
  ctx.font = '12px Tahoma';

  const markers: {
    year: number;
    label: string;
    color: string;
    icon: HTMLImageElement;
  }[] = [];

  function render() {
    ctx.save();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size.width, size.height);

    const step = getStepSize(minYear, maxYear);
    const start = Math.floor(minYear / step) * step;
    const end = Math.ceil(maxYear / step) * step;

    let steps = [];

    for (let i = start; i <= end; i += step) {
      const x = yearToX(i, minYear, maxYear, size.width);
      steps.push(x);

      ctx.fillStyle = 'lightgray';
      ctx.fillRect(x, 20, 1, 40);
      ctx.fillText(yearToString(i, step), x, 13);

      if (i <= end - step) {
        // Draw 4 substeps
        const substep = step / 5;
        for (let j = 1; j < 5; j++) {
          const x = yearToX(i + substep * j, minYear, maxYear, size.width);
          ctx.fillStyle = 'gray';
          ctx.fillRect(x, 20, 1, 20);
        }
      }
    }

    const x = yearToX(year, minYear, maxYear, size.width);
    ctx.fillStyle = 'white';
    ctx.fillRect(x - 1, 20, 3, 40);
    ctx.fillText(yearToString(year, 1), x, 13);

    for (const marker of markers) {
      const x = yearToX(marker.year, minYear, maxYear, size.width);

      // Don't render year if it's too close to a step
      if (!steps.some((s) => Math.abs(s - x) < 50)) {
        ctx.fillStyle = 'lightgray';
        ctx.fillText(yearToString(marker.year, 1), x, 13);
      }

      ctx.fillStyle = marker.color;
      ctx.beginPath();
      ctx.arc(x, 60, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(marker.icon, x - 16, 60 - 16, 32, 32);

      ctx.fillStyle = "white";
      ctx.fillText(marker.label, x, size.height - 2);
    }

    ctx.restore();
  }

  function saveView() {
    localStorage.setItem('timeline', JSON.stringify({
      min: minYear,
      max: maxYear,
      year: year
    }));
  }

  function onClick(clientX: number) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;

    let newYear = xToYear(x, minYear, maxYear, size.width);
    newYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, newYear));

    onYearChange(newYear);

    year = newYear;

    saveView();
    render();
  }

  function onZoom(clientX: number, delta: number, zoomSpeed = ZOOM_SPEED) {
    const x = clientX - canvas.getBoundingClientRect().left;

    // Zoom in/out from the cursor
    const zoom = delta > 0 ? (1 + zoomSpeed) : 1 / (1 + zoomSpeed);
    const cursorYear = xToYear(x, minYear, maxYear, size.width);

    minYear = cursorYear - (cursorYear - minYear) * zoom;
    maxYear = cursorYear + (maxYear - cursorYear) * zoom;

    if (minYear < MIN_YEAR) {
      minYear = MIN_YEAR;
      maxYear = Math.min(minYear + (maxYear - minYear) * zoom, MAX_YEAR);
    }

    if (maxYear > MAX_YEAR) {
      maxYear = MAX_YEAR;
      minYear = Math.max(maxYear - (maxYear - minYear) * zoom, MIN_YEAR);
    }

    saveView();
    render();
  }

  function clampPan(range: number) {
    if (minYear < MIN_YEAR) {
      minYear = MIN_YEAR;
      maxYear = minYear + range;
    }

    if (maxYear > MAX_YEAR) {
      maxYear = MAX_YEAR;
      minYear = maxYear - range;
    }
  }

  function onPan(delta: number) {
    const range = maxYear - minYear;

    const stepSize = range / size.width;
    const deltaYear = -delta * stepSize;

    minYear += deltaYear;
    maxYear += deltaYear;

    clampPan(range);

    saveView();
    render();
  }

  let moving = false;
  let panning = false;

  // Mouse events

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      onClick(e.clientX);
      moving = true;
    } else if (e.button === 2) {
      panning = true;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (moving) onClick(e.clientX);
    if (panning) onPan(e.movementX);
  });

  document.addEventListener('mouseup', () => {
    moving = false;
    panning = false;
  });

  canvas.addEventListener('wheel', (e) => {
    onZoom(e.clientX, e.deltaY > 0 ? 1 : -1);
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

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      onClick(e.touches[0].clientX);
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
    if (moving) onClick(e.touches[0].clientX);

    if (scaling && e.touches.length === 2) {
      const touchDistance = getTouchDistance(e);
      const touchCenterX = getTouchCenterX(e);

      onPan(touchCenterX - lastTouchCenterX);
      onZoom(touchCenterX, (touchDistance > lastTouchDistance ? -1 : 1), 0.05);

      lastTouchDistance = touchDistance;
      lastTouchCenterX = touchCenterX;
    }
  });

  document.addEventListener('touchend', () => {
    moving = false;
    scaling = false;
  });

  canvas.addEventListener('touchcancel', () => {
    moving = false;
    scaling = false;
  });

  render();

  let target = -1;

  function update() {
    if (target === -1) return;

    const delta = target - year;
    const step = delta * 0.1;

    if (Math.abs(step) < 0.1) {
      year = target;
      target = -1;
    } else {
      year += step;
      minYear += step;
      maxYear += step;

      clampPan(maxYear - minYear);
    }

    onYearChange(year);

    saveView();
    render();

    setTimeout(update, 1000 / 30);
  }

  return {
    year: () => target === -1 ? year : target,

    setYear: (newYear: number) => {
      year = newYear;

      // Move min max to center on year
      const range = maxYear - minYear;
      minYear = year - range / 2;
      maxYear = year + range / 2;
      clampPan(range);

      onYearChange(newYear);

      saveView();
      render();
    },

    addMarker(year: number, label: string, color: string, icon: string) {
      const img = new Image();
      img.src = icon;

      img.onload = () => {
        render();
      };

      markers.push({ year, label, color, icon: img });
      render();
    },

    setTarget: (newTarget: number) => {
      target = newTarget;
      update();
    },
  };
}

export type Timeline = Awaited<ReturnType<typeof initTimeline>>;