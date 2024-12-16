import * as THREE from 'three';

async function fetchFloats(url: string): Promise<Float32Array> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return new Float32Array(buffer);
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function createTexture(data: Uint8Array, width: number, height: number, channels: number) {
  const texture = new THREE.DataArrayTexture(data, width, height, channels);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export async function fetchClimate() {
  const [climateBytes, sealevelFloats, iceBytes] = await Promise.all([
    fetchBytes("/climate.bin"),
    fetchFloats("/sealevels.bin"),
    fetchBytes("/ice.bin")
  ]);

  const years = [];
  for (let year = 1; year < 101;) {
    years.push(year);

    // if (year < 26) year += 1;
    // else if (year < 51) year += 5;
    // else if (year < 1001) year += 50;
    // else year += 100;

    year++;
  }

  // Max temperature: 97 by 48 points (LONGITUDE-LATITUDE) (0E - 0W, 87.2N - 87.2S)
  // Min temperature: 97 by 48 points (LONGITUDE-LATITUDE) (0E - 0W, 87.2N - 87.2S)
  // Precipitation: 49 by 48 points (LONGITUDE-LATITUDE) (0E - 0W, 87.2N - 87.2S)

  const tempLength = 97 * 48;
  const precLength = 49 * 48;
  const totalLength = tempLength * 2 + precLength;

  // Data structure: [max, min, precipitation] * years

  const tempData = new Uint8Array(tempLength * 4 * years.length);
  const precData = new Uint8Array(precLength * 4 * years.length);

  for (let y = 0; y < years.length; y++) {
    const max = climateBytes.slice(y * totalLength, y * totalLength + tempLength);
    const min = climateBytes.slice(y * totalLength + tempLength, y * totalLength + tempLength * 2);
    const prec = climateBytes.slice(y * totalLength + tempLength * 2, y * totalLength + totalLength);

    for (let i = 0; i < max.length; i++) {
      const ci = y * tempLength * 4 + i * 4;
      tempData[ci] = max[i];
      tempData[ci + 1] = min[i];
      tempData[ci + 2] = 255;
      tempData[ci + 3] = 255;
    }

    for (let i = 0; i < prec.length; i++) {
      const v = prec[i];
      const ci = y * precLength * 4 + i * 4;
      precData[ci] = v;
      precData[ci + 1] = v;
      precData[ci + 2] = v;
      precData[ci + 3] = 255;
    }
  }

  const tempTexture = createTexture(tempData, 97, 48, years.length);
  const precTexture = createTexture(precData, 49, 48, years.length);

  // Ice data is packed into bytes, each bit is ice or no ice, 1 or 0

  // const iceWidth = 361;
  // const iceHeight = 181;
  const iceWidth = 1441;
  const iceHeight = 721;
  const iceYears = 33;
  const sliceLength = Math.ceil(iceWidth * iceHeight / 8);

  const iceData = new Uint8Array(iceWidth * iceHeight * 4 * iceYears);

  for (let y = 0; y < iceYears; y++) {
    const ice = iceBytes.slice(y * sliceLength, y * sliceLength + sliceLength);

    for (let i = 0; i < ice.length; i++) {
      const byte = ice[i];

      for (let j = 0; j < 8; j++) {
        const v = byte & (1 << j) ? 255 : 0;

        const ci = y * iceWidth * iceHeight * 4 + i * 8 * 4 + j * 4;

        iceData[ci] = v;
        iceData[ci + 1] = v;
        iceData[ci + 2] = v;
        iceData[ci + 3] = 255;
      }
    }
  }

  console.log(iceData);

  const iceTexture = createTexture(iceData, iceWidth, iceHeight, iceYears);

  return {
    years: years,
    climateTextures: {
      temp: tempTexture,
      prec: precTexture,
      ice: iceTexture
    },
    sealevels: sealevelFloats
  };
}

export type FetchClimateResult = Awaited<ReturnType<typeof fetchClimate>>;

export function getClimateYear(data: FetchClimateResult, year: number) {
  let yearIndex = 0;
  for (let j = 1; j < data.years.length; j++) {
    if (year <= data.years[j]) {
      const previousYear = data.years[j - 1];
      yearIndex = j - (1 - (year - previousYear) / (data.years[j] - previousYear));
      break;
    }
  }

  return Math.min(data.years.length - 1, yearIndex);
}

export function getIceYear(data: FetchClimateResult, year: number) {
  // Steps of 2.5 years
  const iceIndex = year / 2.5;
  return Math.max(0, Math.min(32, iceIndex));
}

export function getSeaLevel(data: FetchClimateResult, year: number) {
  // Steps of 0.1 years
  const indexLow = Math.floor(year * 10);
  const indexHigh = Math.ceil(year * 10);

  const sealevelLow = data.sealevels[Math.max(0, Math.min(data.sealevels.length - 1, indexLow))];
  const sealevelHigh = data.sealevels[Math.max(0, Math.min(data.sealevels.length - 1, indexHigh))];

  const sealevel = sealevelLow + (sealevelHigh - sealevelLow) * (year * 10 - indexLow);

  return -sealevel;
}