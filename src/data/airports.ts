import type { Airport } from '../game/types'

// A curated set of Australian outback and regional airports relevant to a
// Royal Flying Doctor Service-style operation. Coordinates are approximate
// (good enough for great-circle distance in a game). `isBase` marks the
// larger hubs where missions tend to originate.
export const AIRPORTS: Airport[] = [
  { icao: 'YBAS', name: 'Alice Springs', state: 'NT', lat: -23.807, lon: 133.902, isBase: true },
  { icao: 'YBHI', name: 'Broken Hill', state: 'NSW', lat: -32.001, lon: 141.472, isBase: true },
  { icao: 'YBCV', name: 'Charleville', state: 'QLD', lat: -26.413, lon: 146.262, isBase: true },
  { icao: 'YBMA', name: 'Mount Isa', state: 'QLD', lat: -20.664, lon: 139.489, isBase: true },
  { icao: 'YPAD', name: 'Adelaide', state: 'SA', lat: -34.945, lon: 138.531, isBase: true },
  { icao: 'YBBN', name: 'Brisbane', state: 'QLD', lat: -27.384, lon: 153.117, isBase: true },
  { icao: 'YPPH', name: 'Perth', state: 'WA', lat: -31.940, lon: 115.967, isBase: true },
  { icao: 'YPDN', name: 'Darwin', state: 'NT', lat: -12.415, lon: 130.877, isBase: true },
  { icao: 'YBCS', name: 'Cairns', state: 'QLD', lat: -16.885, lon: 145.755, isBase: true },
  { icao: 'YBTL', name: 'Townsville', state: 'QLD', lat: -19.253, lon: 146.765, isBase: true },

  { icao: 'YBDV', name: 'Birdsville', state: 'QLD', lat: -25.898, lon: 139.348, isBase: false },
  { icao: 'YDBY', name: 'Derby', state: 'WA', lat: -17.370, lon: 123.661, isBase: false },
  { icao: 'YPKU', name: 'Kununurra', state: 'WA', lat: -15.778, lon: 128.708, isBase: false },
  { icao: 'YBWP', name: 'Weipa', state: 'QLD', lat: -12.679, lon: 141.925, isBase: false },
  { icao: 'YCBP', name: 'Coober Pedy', state: 'SA', lat: -29.040, lon: 134.721, isBase: false },
  { icao: 'YLRE', name: 'Longreach', state: 'QLD', lat: -23.434, lon: 144.280, isBase: false },
  { icao: 'YSDU', name: 'Dubbo', state: 'NSW', lat: -32.217, lon: 148.575, isBase: false },
  { icao: 'YCCY', name: 'Cloncurry', state: 'QLD', lat: -20.668, lon: 140.504, isBase: false },
  { icao: 'YTNK', name: 'Tennant Creek', state: 'NT', lat: -19.634, lon: 134.183, isBase: false },
  { icao: 'YPTN', name: 'Tindal / Katherine', state: 'NT', lat: -14.521, lon: 132.378, isBase: false },
  { icao: 'YPAG', name: 'Port Augusta', state: 'SA', lat: -32.507, lon: 137.717, isBase: false },
  { icao: 'YWHA', name: 'Whyalla', state: 'SA', lat: -33.059, lon: 137.514, isBase: false },
  { icao: 'YMOR', name: 'Moree', state: 'NSW', lat: -29.499, lon: 149.845, isBase: false },
  { icao: 'YCAR', name: 'Carnarvon', state: 'WA', lat: -24.880, lon: 113.672, isBase: false },
  { icao: 'YMEK', name: 'Meekatharra', state: 'WA', lat: -26.612, lon: 118.548, isBase: false },
  { icao: 'YOOM', name: 'Moomba', state: 'SA', lat: -28.099, lon: 140.197, isBase: false },
  { icao: 'YWDH', name: 'Windorah', state: 'QLD', lat: -25.413, lon: 142.667, isBase: false },
  { icao: 'YCOM', name: 'Cooma', state: 'NSW', lat: -36.301, lon: 148.973, isBase: false },
  { icao: 'YLEC', name: 'Leigh Creek', state: 'SA', lat: -30.598, lon: 138.426, isBase: false },
  { icao: 'YHUG', name: 'Hughenden', state: 'QLD', lat: -20.815, lon: 144.225, isBase: false },
]

const BY_ICAO = new Map(AIRPORTS.map((a) => [a.icao, a]))

export function getAirport(icao: string): Airport {
  const a = BY_ICAO.get(icao)
  if (!a) throw new Error(`Unknown airport: ${icao}`)
  return a
}

export function tryGetAirport(icao: string): Airport | undefined {
  return BY_ICAO.get(icao)
}

export const BASES = AIRPORTS.filter((a) => a.isBase)
