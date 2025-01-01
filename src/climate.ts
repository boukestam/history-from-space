import { LinearFilter, RepeatWrapping, DataArrayTexture, BufferGeometry, BufferAttribute } from "three";
import { areaToGeometry } from "./util/curve";

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
  const texture = new DataArrayTexture(data, width, height, channels);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export async function fetchClimate() {
  const [climateBytes, sealevelFloats, iceBytes, riverBytes] = await Promise.all([
    fetchBytes("climate.bin"),
    fetchFloats("sealevels.bin"),
    fetchBytes("ice_outline.bin"),
    fetchBytes("rivers.bin")
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

  // Ice data is packed into bytes, containing 33 year chunks
  // Each chunk starts with a 4 byte int for the size of the subsequent data
  // Chunk:
  // 2 byte int: number of geometries
  // n * geometry:
  //  2 byte int: number of points
  //  n * 4 byte float: x, y, z
  //  2 byte int: number of indices
  //  n * 2 byte int: indices

  const iceData = new DataView(iceBytes.buffer);

  const iceGeometries = [];

  for (let i = 0; i < iceBytes.length;) {
    // const length = iceData.getUint32(i, true);
    i += 4;

    const geometriesLength = iceData.getUint16(i, true);
    i += 2;

    const geometries = [];

    for (let j = 0; j < geometriesLength; j++) {
      const pointsLength = iceData.getUint16(i, true);
      i += 2;

      if (pointsLength === 0) continue;

      // const points = [];

      // for (let j = 0; j < pointsLength; j++) {
      //   const x = iceData.getFloat32(i, true);
      //   i += 4;
      //   const y = iceData.getFloat32(i, true);
      //   i += 4;
      //   const z = iceData.getFloat32(i, true);
      //   i += 4;

      //   points.push([x, y, z]);
      // }

      // const indicesLength = iceData.getUint16(i, true);
      // i += 2;

      // const indices = [];

      // for (let j = 0; j < indicesLength; j++) {
      //   indices.push(iceData.getUint16(i, true));
      //   i += 2;
      // }

      // const geometry = new BufferGeometry();
      // geometry.setAttribute("position", new BufferAttribute(new Float32Array(points.flat()), 3));
      // geometry.setIndex(indices);

      // geometry.computeVertexNormals();

      // geometries.push(geometry);

      const coordinates: [number, number][] = [];

      for (let j = 0; j < pointsLength; j++) {
        const latitude = iceData.getFloat32(i, true);
        i += 4;
        const longitude = iceData.getFloat32(i, true);
        i += 4;

        coordinates.push([latitude, longitude]);
      }

      const { geometry } = areaToGeometry(coordinates);
      geometries.push(geometry);
    }

    iceGeometries.push(geometries);
  }

  // Load rivers
  const rivers = [];
  const riverData = new DataView(riverBytes.buffer);

  for (let i = 0; i < riverBytes.length;) {
    const length = riverData.getUint16(i, true);
    i += 2;

    const river = [];

    for (let j = 0; j < length; j++) {
      const lon = riverData.getFloat32(i, true);
      i += 4;
      const lat = riverData.getFloat32(i, true);
      i += 4;

      river.push([lat, lon]);
    }

    rivers.push(river);
  }

  return {
    years: years,
    climateTextures: {
      temp: tempTexture,
      prec: precTexture,
    },
    sealevels: sealevelFloats,
    rivers: rivers,
    iceGeometries: iceGeometries,
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

export function getIceYear(_: FetchClimateResult, year: number) {
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