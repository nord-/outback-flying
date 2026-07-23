import type { Airport } from '../game/types'

// Curated airport sets per world region. Coordinates are approximate (good
// enough for great-circle distance in a game). `isBase` marks the larger
// hubs where missions tend to originate.

// --- Australian Outback -----------------------------------------------------
const OUTBACK: Omit<Airport, 'region'>[] = [
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

// --- East Africa ------------------------------------------------------------
const AFRICA: Omit<Airport, 'region'>[] = [
  { icao: 'HKNW', name: 'Nairobi Wilson', state: 'Kenya', lat: -1.322, lon: 36.815, isBase: true },
  { icao: 'HKJK', name: 'Nairobi Kenyatta', state: 'Kenya', lat: -1.319, lon: 36.928, isBase: true },
  { icao: 'HKMO', name: 'Mombasa Moi', state: 'Kenya', lat: -4.035, lon: 39.594, isBase: true },
  { icao: 'HTKJ', name: 'Kilimanjaro', state: 'Tanzania', lat: -3.429, lon: 37.074, isBase: true },
  { icao: 'HUEN', name: 'Entebbe', state: 'Uganda', lat: 0.042, lon: 32.443, isBase: true },
  { icao: 'HTDA', name: 'Dar es Salaam', state: 'Tanzania', lat: -6.878, lon: 39.203, isBase: true },
  { icao: 'HKKI', name: 'Kisumu', state: 'Kenya', lat: -0.086, lon: 34.729, isBase: false },
  { icao: 'HKEL', name: 'Eldoret', state: 'Kenya', lat: 0.404, lon: 35.239, isBase: false },
  { icao: 'HKML', name: 'Malindi', state: 'Kenya', lat: -3.229, lon: 40.101, isBase: false },
  { icao: 'HKWJ', name: 'Wajir', state: 'Kenya', lat: 1.733, lon: 40.092, isBase: false },
  { icao: 'HKLO', name: 'Lodwar', state: 'Kenya', lat: 3.122, lon: 35.609, isBase: false },
  { icao: 'HKLK', name: 'Lokichogio', state: 'Kenya', lat: 4.204, lon: 34.348, isBase: false },
  { icao: 'HKGA', name: 'Garissa', state: 'Kenya', lat: -0.463, lon: 39.648, isBase: false },
  { icao: 'HKMB', name: 'Marsabit', state: 'Kenya', lat: 2.407, lon: 37.980, isBase: false },
  { icao: 'HTAR', name: 'Arusha', state: 'Tanzania', lat: -3.368, lon: 36.633, isBase: false },
  { icao: 'HTZA', name: 'Zanzibar', state: 'Tanzania', lat: -6.222, lon: 39.225, isBase: false },
  { icao: 'HTMW', name: 'Mwanza', state: 'Tanzania', lat: -2.444, lon: 32.933, isBase: false },
  { icao: 'HTDO', name: 'Dodoma', state: 'Tanzania', lat: -6.170, lon: 35.753, isBase: false },
  { icao: 'HSSJ', name: 'Juba', state: 'South Sudan', lat: 4.872, lon: 31.601, isBase: false },
  { icao: 'HAAB', name: 'Addis Ababa', state: 'Ethiopia', lat: 8.978, lon: 38.799, isBase: false },
]

// --- Alaska & the North -----------------------------------------------------
const NAMERICA: Omit<Airport, 'region'>[] = [
  { icao: 'PANC', name: 'Anchorage', state: 'Alaska', lat: 61.174, lon: -149.996, isBase: true },
  { icao: 'PAFA', name: 'Fairbanks', state: 'Alaska', lat: 64.815, lon: -147.856, isBase: true },
  { icao: 'PAJN', name: 'Juneau', state: 'Alaska', lat: 58.355, lon: -134.576, isBase: true },
  { icao: 'PABE', name: 'Bethel', state: 'Alaska', lat: 60.780, lon: -161.838, isBase: true },
  { icao: 'PAOM', name: 'Nome', state: 'Alaska', lat: 64.512, lon: -165.445, isBase: true },
  { icao: 'CYZF', name: 'Yellowknife', state: 'Canada', lat: 62.463, lon: -114.440, isBase: true },
  { icao: 'PAOT', name: 'Kotzebue', state: 'Alaska', lat: 66.885, lon: -162.599, isBase: false },
  { icao: 'PABR', name: 'Utqiagvik (Barrow)', state: 'Alaska', lat: 71.285, lon: -156.766, isBase: false },
  { icao: 'PAMC', name: 'McGrath', state: 'Alaska', lat: 62.953, lon: -155.606, isBase: false },
  { icao: 'PADL', name: 'Dillingham', state: 'Alaska', lat: 59.045, lon: -158.505, isBase: false },
  { icao: 'PAKN', name: 'King Salmon', state: 'Alaska', lat: 58.677, lon: -156.649, isBase: false },
  { icao: 'PADQ', name: 'Kodiak', state: 'Alaska', lat: 57.750, lon: -152.494, isBase: false },
  { icao: 'PASC', name: 'Deadhorse', state: 'Alaska', lat: 70.195, lon: -148.465, isBase: false },
  { icao: 'PANI', name: 'Aniak', state: 'Alaska', lat: 61.582, lon: -159.543, isBase: false },
  { icao: 'PAGA', name: 'Galena', state: 'Alaska', lat: 64.736, lon: -156.938, isBase: false },
  { icao: 'PAUN', name: 'Unalakleet', state: 'Alaska', lat: 63.888, lon: -160.799, isBase: false },
  { icao: 'CYXY', name: 'Whitehorse', state: 'Canada', lat: 60.710, lon: -135.067, isBase: false },
  { icao: 'CYVQ', name: 'Norman Wells', state: 'Canada', lat: 65.281, lon: -126.798, isBase: false },
  { icao: 'CYFB', name: 'Iqaluit', state: 'Canada', lat: 63.756, lon: -68.556, isBase: false },
]

const withRegion = (list: Omit<Airport, 'region'>[], region: string): Airport[] =>
  list.map((a) => ({ ...a, region }))

export const AIRPORTS: Airport[] = [
  ...withRegion(OUTBACK, 'outback'),
  ...withRegion(AFRICA, 'africa'),
  ...withRegion(NAMERICA, 'namerica'),
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

export function airportsInRegion(regionId: string): Airport[] {
  return AIRPORTS.filter((a) => a.region === regionId)
}

export function basesInRegion(regionId: string): Airport[] {
  return AIRPORTS.filter((a) => a.region === regionId && a.isBase)
}

// Backwards-compatible aliases. Prefer the region-scoped helpers above; these
// cover the whole world and should only be used where region is irrelevant.
export const BASES = AIRPORTS.filter((a) => a.isBase)
