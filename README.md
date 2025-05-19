# History from Space
An interactive model of Earth over the last 100,000 years. It visualizes changing sea levels, climate, and ice sheets using scientific datasets and WebGL (via THREE.js).

🌍 [Live demo](https://technistuff.com/history-from-space/)
📖 [Read the blog post](https://technistuff.com/posts/visualizing-100000-years-of-earth-in-webgl/)
📹 [Watch the video](https://www.youtube.com/watch?v=srO5sq4_Mxw)

## Features

- Elevation map with compressed height data
- Sea level changes over time
- Simulated climate (rainfall & temperature)
- Ice sheet visualization using triangulated geometry
- Modern borders for reference
- GPU shaders for smooth rendering
- Show historical events (WIP)

## Setup

```bash
yarn
yarn dev
```

Then open `localhost:3000`

## Data Sources

- Elevation: NOAA ETOPO
- Sea levels: Spratt & Lisiecki (2016)
- Climate: TraCE-21ka
- Ice sheets: ICE-6G_C
- Borders: OpenDataSoft

See the blog for full source links and processing details.

## License
MIT — do whatever you want, but attribution is appreciated.
Data may have separate licenses (check source links).

