import type { Airport, FieldType, FuelType } from '../game/types'

// Curated airport sets per world region. Coordinates are approximate (good
// enough for great-circle distance in a game). `type` is the field's game
// role — 'hub' is where missions tend to originate and where the market is;
// it is deliberately NOT derived from runway/surface, since a long gravel
// runway can perfectly well be a hub (see the #5 design spec, B5).
//
// Physical field data (runwayM / surface / lighted) comes from the OurAirports
// public-domain dataset, snapshot 2026-07-27, via scripts/curate-airports.mjs.
// Three fields (HKML, HKMB, HSSJ) needed a manual fill because the script
// reported NO USABLE RUNWAY / MISSING FROM DATASET for them; the sourcing
// and doubt on each is noted inline above the entry.

// --- Australian Outback -----------------------------------------------------
const OUTBACK: Omit<Airport, 'region'>[] = [
  { icao: 'YBAS', name: 'Alice Springs', state: 'NT', lat: -23.807, lon: 133.902, type: 'hub', runwayM: 2440, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YBHI', name: 'Broken Hill', state: 'NSW', lat: -32.001, lon: 141.472, type: 'hub', runwayM: 2510, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YBCV', name: 'Charleville', state: 'QLD', lat: -26.413, lon: 146.262, type: 'hub', runwayM: 1520, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YBMA', name: 'Mount Isa', state: 'QLD', lat: -20.664, lon: 139.489, type: 'hub', runwayM: 2560, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YPAD', name: 'Adelaide', state: 'SA', lat: -34.945, lon: 138.531, type: 'hub', runwayM: 3100, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YBBN', name: 'Brisbane', state: 'QLD', lat: -27.384, lon: 153.117, type: 'hub', runwayM: 3560, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YPPH', name: 'Perth', state: 'WA', lat: -31.940, lon: 115.967, type: 'hub', runwayM: 3440, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YPDN', name: 'Darwin', state: 'NT', lat: -12.415, lon: 130.877, type: 'hub', runwayM: 3350, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YBCS', name: 'Cairns', state: 'QLD', lat: -16.885, lon: 145.755, type: 'hub', runwayM: 3200, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YBTL', name: 'Townsville', state: 'QLD', lat: -19.253, lon: 146.765, type: 'hub', runwayM: 2440, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'YBDV', name: 'Birdsville', state: 'QLD', lat: -25.898, lon: 139.348, type: 'regional', runwayM: 1730, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YDBY', name: 'Derby', state: 'WA', lat: -17.370, lon: 123.661, type: 'regional', runwayM: 1740, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YPKU', name: 'Kununurra', state: 'WA', lat: -15.778, lon: 128.708, type: 'regional', runwayM: 1830, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YBWP', name: 'Weipa', state: 'QLD', lat: -12.679, lon: 141.925, type: 'regional', runwayM: 1650, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // Fix round 1: the longest runway (04/22, 4685 ft) has surface code 'PER'
  // (permeable/porous friction course — a sealed wearing surface, not a
  // distinct material; see SURFACE_MAP in curate-airports.mjs), which was
  // unmapped and got silently skipped in favour of the 2720 ft grass
  // secondary. Now correctly reports the sealed primary.
  { icao: 'YCBP', name: 'Coober Pedy', state: 'SA', lat: -29.040, lon: 134.721, type: 'regional', runwayM: 1430, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YLRE', name: 'Longreach', state: 'QLD', lat: -23.434, lon: 144.280, type: 'regional', runwayM: 1940, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YSDU', name: 'Dubbo', state: 'NSW', lat: -32.217, lon: 148.575, type: 'regional', runwayM: 1710, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YCCY', name: 'Cloncurry', state: 'QLD', lat: -20.668, lon: 140.504, type: 'regional', runwayM: 2000, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YTNK', name: 'Tennant Creek', state: 'NT', lat: -19.634, lon: 134.183, type: 'regional', runwayM: 1960, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YPTN', name: 'Tindal / Katherine', state: 'NT', lat: -14.521, lon: 132.378, type: 'regional', runwayM: 2740, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YPAG', name: 'Port Augusta', state: 'SA', lat: -32.507, lon: 137.717, type: 'regional', runwayM: 1650, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YWHA', name: 'Whyalla', state: 'SA', lat: -33.059, lon: 137.514, type: 'regional', runwayM: 1690, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YMOR', name: 'Moree', state: 'NSW', lat: -29.499, lon: 149.845, type: 'regional', runwayM: 1610, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YCAR', name: 'Carnarvon', state: 'WA', lat: -24.880, lon: 113.672, type: 'regional', runwayM: 1680, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YMEK', name: 'Meekatharra', state: 'WA', lat: -26.612, lon: 118.548, type: 'regional', runwayM: 2180, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YOOM', name: 'Moomba', state: 'SA', lat: -28.099, lon: 140.197, type: 'regional', runwayM: 1720, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YWDH', name: 'Windorah', state: 'QLD', lat: -25.413, lon: 142.667, type: 'regional', runwayM: 1370, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YCOM', name: 'Cooma', state: 'NSW', lat: -36.301, lon: 148.973, type: 'regional', runwayM: 2120, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YLEC', name: 'Leigh Creek', state: 'SA', lat: -30.598, lon: 138.426, type: 'regional', runwayM: 1710, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YHUG', name: 'Hughenden', state: 'QLD', lat: -20.815, lon: 144.225, type: 'regional', runwayM: 1640, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // Bush strips — unsealed station, community and homestead fields, nearly
  // all without fuel. Physical data from OurAirports, snapshot 2026-07-27.
  { icao: 'YABF', name: 'Aberfoyle Airport', state: 'QLD', lat: -21.671, lon: 145.266, type: 'strip', runwayM: 660, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YABG', name: 'Abbieglassie Airstrip', state: 'QLD', lat: -27.248, lon: 147.578, type: 'strip', runwayM: 1100, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YBDP', name: 'Flinders Island Aviation (Bridport)', state: 'TAS', lat: -41.024, lon: 147.417, type: 'strip', runwayM: 760, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YBRA', name: 'Benambra Airport', state: 'VIC', lat: -36.967, lon: 147.699, type: 'strip', runwayM: 1160, surface: 'gravel', lighted: true, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YCPK', name: 'Coombing Park Airport', state: 'NSW', lat: -33.629, lon: 149.126, type: 'strip', runwayM: 1160, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YCVA', name: 'Clare Valley Aerodrome', state: 'SA', lat: -33.71, lon: 138.585, type: 'strip', runwayM: 1200, surface: 'dirt', lighted: false, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'YFRV', name: 'Oombulgurri Airport', state: 'WA', lat: -15.165, lon: 127.84, type: 'strip', runwayM: 1180, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YKUR', name: 'Kurundi Airport', state: 'NT', lat: -20.51, lon: 134.671, type: 'strip', runwayM: 890, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YLEA', name: 'Leeman Airport', state: 'WA', lat: -29.97, lon: 114.983, type: 'strip', runwayM: 1200, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YMCE', name: 'Mount Clere Homestead Airport', state: 'WA', lat: -25.1, lon: 117.583, type: 'strip', runwayM: 1200, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YMHO', name: 'Mount House Airport', state: 'WA', lat: -17.052, lon: 125.712, type: 'strip', runwayM: 1070, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YMIR', name: 'Miranda Downs Airport', state: 'QLD', lat: -17.329, lon: 141.886, type: 'strip', runwayM: 1010, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YMRG', name: 'Murgon Airport', state: 'QLD', lat: -26.253, lon: 151.93, type: 'strip', runwayM: 720, surface: 'grass', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YNHL', name: 'Nhill Airport', state: 'VIC', lat: -36.31, lon: 141.643, type: 'strip', runwayM: 1100, surface: 'grass', lighted: true, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'YPFL', name: 'Preston Field - Blair Howe', state: 'WA', lat: -33.022, lon: 115.702, type: 'strip', runwayM: 920, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YPGH', name: 'Pigeon Hole Airport', state: 'NT', lat: -16.82, lon: 131.206, type: 'strip', runwayM: 1040, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YUSL', name: 'Useless Loop Airport', state: 'WA', lat: -26.158, lon: 113.395, type: 'strip', runwayM: 1000, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YWGM', name: 'White Gum Air Park', state: 'WA', lat: -31.864, lon: 116.936, type: 'strip', runwayM: 1160, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
]

// --- East Africa ------------------------------------------------------------
const AFRICA: Omit<Airport, 'region'>[] = [
  // lighted: false is OurAirports' raw flag for this runway; implausible for
  // Africa's busiest GA hub, unconfirmed elsewhere — DOUBTFUL.
  { icao: 'HKNW', name: 'Nairobi Wilson', state: 'Kenya', lat: -1.322, lon: 36.815, type: 'hub', runwayM: 1540, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'HKJK', name: 'Nairobi Kenyatta', state: 'Kenya', lat: -1.319, lon: 36.928, type: 'hub', runwayM: 4120, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'HKMO', name: 'Mombasa Moi', state: 'Kenya', lat: -4.035, lon: 39.594, type: 'hub', runwayM: 3350, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'HTKJ', name: 'Kilimanjaro', state: 'Tanzania', lat: -3.429, lon: 37.074, type: 'hub', runwayM: 3600, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'HUEN', name: 'Entebbe', state: 'Uganda', lat: 0.042, lon: 32.443, type: 'hub', runwayM: 3660, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'HTDA', name: 'Dar es Salaam', state: 'Tanzania', lat: -6.878, lon: 39.203, type: 'hub', runwayM: 3000, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'HKKI', name: 'Kisumu', state: 'Kenya', lat: -0.086, lon: 34.729, type: 'regional', runwayM: 3300, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HKEL', name: 'Eldoret', state: 'Kenya', lat: 0.404, lon: 35.239, type: 'regional', runwayM: 3500, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // runwayM/surface manual: OurAirports lists runway 17/35 at 4600 ft but
  // surface 'UNK'; asphalt confirmed via en.wikipedia.org/wiki/Malindi_Airport
  // (same runway, same length). lighted: false per OurAirports' raw flag for
  // that runway (unconfirmed elsewhere) — DOUBTFUL.
  { icao: 'HKML', name: 'Malindi', state: 'Kenya', lat: -3.229, lon: 40.101, type: 'regional', runwayM: 1400, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HKWJ', name: 'Wajir', state: 'Kenya', lat: 1.733, lon: 40.092, type: 'regional', runwayM: 2800, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HKLO', name: 'Lodwar', state: 'Kenya', lat: 3.122, lon: 35.609, type: 'regional', runwayM: 1000, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HKLK', name: 'Lokichogio', state: 'Kenya', lat: 4.204, lon: 34.348, type: 'regional', runwayM: 1890, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HKGA', name: 'Garissa', state: 'Kenya', lat: -0.463, lon: 39.648, type: 'regional', runwayM: 1080, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // Fully manual: absent from OurAirports runways.csv entirely. Length/surface
  // from en.wikipedia.org/wiki/Marsabit_Airport (1104 m / 3623 ft, asphalt);
  // one other source (SkyVector) disagreed on surface ('Soft'), unresolved.
  // lighted: false is an inference (remote strip, no scheduled service), not
  // sourced — DOUBTFUL.
  { icao: 'HKMB', name: 'Marsabit', state: 'Kenya', lat: 2.407, lon: 37.980, type: 'regional', runwayM: 1100, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HTAR', name: 'Arusha', state: 'Tanzania', lat: -3.368, lon: 36.633, type: 'regional', runwayM: 1640, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HTZA', name: 'Zanzibar', state: 'Tanzania', lat: -6.222, lon: 39.225, type: 'regional', runwayM: 3020, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HTMW', name: 'Mwanza', state: 'Tanzania', lat: -2.444, lon: 32.933, type: 'regional', runwayM: 3110, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HTDO', name: 'Dodoma', state: 'Tanzania', lat: -6.170, lon: 35.753, type: 'regional', runwayM: 2040, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // Manual: OurAirports has no 'HSSJ' ident — this airport is listed there
  // under 'HJJJ' (South Sudan's post-2011-independence ICAO code; HSSJ was
  // the Sudan-era one this catalogue uses). Runway 13/31, 10171 ft, ASP,
  // lighted=1; corroborated by en.wikipedia.org/wiki/Juba_International_Airport.
  { icao: 'HSSJ', name: 'Juba', state: 'South Sudan', lat: 4.872, lon: 31.601, type: 'regional', runwayM: 3100, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'HAAB', name: 'Addis Ababa', state: 'Ethiopia', lat: 8.978, lon: 38.799, type: 'regional', runwayM: 3800, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // Bush strips — safari and park airstrips. Coordinates from OurAirports;
  // runway length and surface from OpenStreetMap via the Overpass API
  // (© OpenStreetMap contributors, ODbL), snapshot 2026-07-27.
  { icao: 'HKKE', name: 'Keekorok', state: 'Kenya', lat: -1.586, lon: 35.257, type: 'strip', runwayM: 1520, surface: 'grass', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HKHZ', name: 'Segera Ranch', state: 'Kenya', lat: 0.185, lon: 36.91, type: 'strip', runwayM: 1460, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HKMS', name: 'Mara Serena', state: 'Kenya', lat: -1.405, lon: 35.008, type: 'strip', runwayM: 1040, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HKMF', name: 'Mara North Conservancy', state: 'Kenya', lat: -1.145, lon: 35.125, type: 'strip', runwayM: 1400, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HKOY', name: 'Ol Seki Naboisho', state: 'Kenya', lat: -1.378, lon: 35.38, type: 'strip', runwayM: 1020, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HKSL', name: 'Solio Ranch', state: 'Kenya', lat: -0.243, lon: 36.881, type: 'strip', runwayM: 1440, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HTGR', name: 'Kirawira', state: 'Tanzania', lat: -2.161, lon: 34.226, type: 'strip', runwayM: 990, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HTZW', name: 'Siwandu', state: 'Tanzania', lat: -7.685, lon: 38.137, type: 'strip', runwayM: 1280, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HTMR', name: 'Msembe (Ruaha)', state: 'Tanzania', lat: -7.685, lon: 34.922, type: 'strip', runwayM: 1200, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HTML', name: 'Mahale', state: 'Tanzania', lat: -6.013, lon: 29.767, type: 'strip', runwayM: 1060, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HTND', name: 'Ndutu', state: 'Tanzania', lat: -3.031, lon: 34.988, type: 'strip', runwayM: 1220, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HUGG', name: 'Bugungu', state: 'Uganda', lat: 2.203, lon: 31.554, type: 'strip', runwayM: 1540, surface: 'sand', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HUKD', name: 'Kidepo', state: 'Uganda', lat: 3.718, lon: 33.749, type: 'strip', runwayM: 1490, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'HUKS', name: 'Kasese', state: 'Uganda', lat: 0.183, lon: 30.1, type: 'strip', runwayM: 1680, surface: 'grass', lighted: false, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'HUMW', name: 'Mweya', state: 'Uganda', lat: -0.194, lon: 29.894, type: 'strip', runwayM: 1250, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
]

// --- Alaska & the North -----------------------------------------------------
const NAMERICA: Omit<Airport, 'region'>[] = [
  { icao: 'PANC', name: 'Anchorage', state: 'Alaska', lat: 61.174, lon: -149.996, type: 'hub', runwayM: 3780, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  // lighted: false is OurAirports' raw flag for this runway; implausible for
  // an international airport, unconfirmed elsewhere — DOUBTFUL.
  { icao: 'PAFA', name: 'Fairbanks', state: 'Alaska', lat: 64.815, lon: -147.856, type: 'hub', runwayM: 3600, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'PAJN', name: 'Juneau', state: 'Alaska', lat: 58.355, lon: -134.576, type: 'hub', runwayM: 2700, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  // runwayM/lighted use the 6400 ft ASPH-F runway (01L/19R, lighted=1), not
  // the shorter 4000 ft one — see the 'ASPH-F' note in curate-airports.mjs.
  { icao: 'PABE', name: 'Bethel', state: 'Alaska', lat: 60.780, lon: -161.838, type: 'hub', runwayM: 1950, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'PAOM', name: 'Nome', state: 'Alaska', lat: 64.512, lon: -165.445, type: 'hub', runwayM: 1880, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'CYZF', name: 'Yellowknife', state: 'Canada', lat: 62.463, lon: -114.440, type: 'hub', runwayM: 2290, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.0 },
  { icao: 'PAOT', name: 'Kotzebue', state: 'Alaska', lat: 66.885, lon: -162.599, type: 'regional', runwayM: 1920, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'PABR', name: 'Utqiagvik (Barrow)', state: 'Alaska', lat: 71.285, lon: -156.766, type: 'regional', runwayM: 2160, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'PAMC', name: 'McGrath', state: 'Alaska', lat: 62.953, lon: -155.606, type: 'regional', runwayM: 1810, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'PADL', name: 'Dillingham', state: 'Alaska', lat: 59.045, lon: -158.505, type: 'regional', runwayM: 1950, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // runwayM uses the 8901 ft ASPH-F runway (12/30), not the shorter 4017 ft
  // one — see the 'ASPH-F' note in curate-airports.mjs. lighted=false is
  // OurAirports' raw flag for that runway; unconfirmed elsewhere — DOUBTFUL.
  { icao: 'PAKN', name: 'King Salmon', state: 'Alaska', lat: 58.677, lon: -156.649, type: 'regional', runwayM: 2710, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'PADQ', name: 'Kodiak', state: 'Alaska', lat: 57.750, lon: -152.494, type: 'regional', runwayM: 2300, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'PASC', name: 'Deadhorse', state: 'Alaska', lat: 70.195, lon: -148.465, type: 'regional', runwayM: 1980, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // runwayM uses the 6200 ft ASPH-F runway (11/29) — see the 'ASPH-F' note in
  // curate-airports.mjs. lighted=false is OurAirports' raw flag; AirNav
  // (airnav.com/airport/PANI) instead reports HIRL/MALSF/PAPI — DOUBTFUL.
  { icao: 'PANI', name: 'Aniak', state: 'Alaska', lat: 61.582, lon: -159.543, type: 'regional', runwayM: 1890, surface: 'sealed', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'PAGA', name: 'Galena', state: 'Alaska', lat: 64.736, lon: -156.938, type: 'regional', runwayM: 1830, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'PAUN', name: 'Unalakleet', state: 'Alaska', lat: 63.888, lon: -160.799, type: 'regional', runwayM: 1800, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'CYXY', name: 'Whitehorse', state: 'Canada', lat: 60.710, lon: -135.067, type: 'regional', runwayM: 2890, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'CYVQ', name: 'Norman Wells', state: 'Canada', lat: 65.281, lon: -126.798, type: 'regional', runwayM: 1830, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'CYFB', name: 'Iqaluit', state: 'Canada', lat: 63.756, lon: -68.556, type: 'regional', runwayM: 2620, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  // Bush strips — village, lodge and former station fields. Physical data
  // from OurAirports, snapshot 2026-07-27.
  { icao: '02AK', name: 'Rustic Wilderness Airport', state: 'Alaska', lat: 61.877, lon: -150.098, type: 'strip', runwayM: 670, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: '51AK', name: 'Birch Creek Landing', state: 'Alaska', lat: 62.239, lon: -150.064, type: 'strip', runwayM: 760, surface: 'grass', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: '8AK3', name: 'Roland Norton Memorial Airstrip', state: 'Alaska', lat: 66.766, lon: -160.153, type: 'strip', runwayM: 910, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'AK13', name: 'Chena Hot Springs Airport', state: 'Alaska', lat: 65.052, lon: -146.047, type: 'strip', runwayM: 910, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'AK20', name: 'CD-3 Airstrip', state: 'Alaska', lat: 70.421, lon: -150.887, type: 'strip', runwayM: 1070, surface: 'gravel', lighted: true, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'AK49', name: 'Taylor Airport', state: 'Alaska', lat: 65.679, lon: -164.799, type: 'strip', runwayM: 670, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'AK61', name: 'Stephan Lake Lodge Airport', state: 'Alaska', lat: 62.697, lon: -148.918, type: 'strip', runwayM: 910, surface: 'grass', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'CEU9', name: 'Sambaa K\'e Airport', state: 'Canada', lat: 60.423, lon: -121.27, type: 'strip', runwayM: 1070, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'CYVM', name: 'Qikiqtarjuaq Airport', state: 'Canada', lat: 67.547, lon: -64.031, type: 'strip', runwayM: 1160, surface: 'gravel', lighted: true, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'CYWJ', name: 'Déline Airport', state: 'Canada', lat: 65.211, lon: -123.436, type: 'strip', runwayM: 1200, surface: 'gravel', lighted: false, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'CYXP', name: 'Pangnirtung Airport', state: 'Canada', lat: 66.145, lon: -65.714, type: 'strip', runwayM: 890, surface: 'gravel', lighted: true, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'CZFM', name: 'Fort Mcpherson Airport', state: 'Canada', lat: 67.407, lon: -134.86, type: 'strip', runwayM: 1070, surface: 'gravel', lighted: true, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'K3AK', name: 'Dry Bay Airport', state: 'Alaska', lat: 59.164, lon: -138.489, type: 'strip', runwayM: 1100, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'LSR', name: 'Lost River 1 Airport', state: 'Alaska', lat: 65.398, lon: -167.168, type: 'strip', runwayM: 1110, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'PACM', name: 'Scammon Bay Airport', state: 'Alaska', lat: 61.845, lon: -165.575, type: 'strip', runwayM: 910, surface: 'dirt', lighted: true, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'PAEH', name: 'Cape Newenham LRRS Airport', state: 'Alaska', lat: 58.646, lon: -162.063, type: 'strip', runwayM: 1200, surface: 'gravel', lighted: true, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'PAEW', name: 'Mertarvik Airport', state: 'Alaska', lat: 60.81, lon: -164.5, type: 'strip', runwayM: 1010, surface: 'gravel', lighted: true, fuelTypes: ['AVGAS'], fuelPriceMult: 1.35 },
  { icao: 'PAGZ', name: 'Granite Mountain Air Station', state: 'Alaska', lat: 65.402, lon: -161.281, type: 'strip', runwayM: 1180, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'PAWT', name: 'Wainwright Air Station', state: 'Alaska', lat: 70.614, lon: -159.863, type: 'strip', runwayM: 910, surface: 'gravel', lighted: true, fuelTypes: [], fuelPriceMult: 1.35 },
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

/** Does this field offer the given fuel type? Unknown field → false. */
export function airportOffersFuel(icao: string, type: FuelType): boolean {
  return tryGetAirport(icao)?.fuelTypes.includes(type) ?? false
}

/** Classify a field's fuel offering against what an aircraft needs. Pure over
 *  the offered list so it is testable without any no-fuel fields existing yet. */
export function classifyFuel(offered: FuelType[], need: FuelType): 'ok' | 'no-fuel' | 'wrong-type' {
  if (offered.length === 0) return 'no-fuel'
  return offered.includes(need) ? 'ok' : 'wrong-type'
}

export function airportsInRegion(regionId: string): Airport[] {
  return AIRPORTS.filter((a) => a.region === regionId)
}

export function airportsInRegionOfTypes(regionId: string, types: readonly FieldType[]): Airport[] {
  return AIRPORTS.filter((a) => a.region === regionId && types.includes(a.type))
}

export function hubsInRegion(regionId: string): Airport[] {
  return airportsInRegionOfTypes(regionId, ['hub'])
}
