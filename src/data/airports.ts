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
  // Wimmera/Mallee region, VIC — matched against installed MSFS scenery
  // addons (Mid Western Victoria pack). Real OurAirports data throughout;
  // YSLK and YWYF carry an unmapped surface code ('G'/'C') so surface is
  // 'unknown' rather than guessed.
  { icao: 'YARA', name: 'Ararat Airport', state: 'VIC', lat: -37.309978, lon: 142.988688, type: 'regional', runwayM: 1240, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YBIR', name: 'Birchip Airport', state: 'VIC', lat: -35.999699, lon: 142.917007, type: 'regional', runwayM: 1040, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YDOD', name: 'Donald Airport', state: 'VIC', lat: -36.360298, lon: 143.007996, type: 'regional', runwayM: 1170, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YHPN', name: 'Hopetoun Airport', state: 'VIC', lat: -35.715302, lon: 142.360001, type: 'regional', runwayM: 1140, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YHSM', name: 'Horsham Airport', state: 'VIC', lat: -36.669701, lon: 142.173004, type: 'regional', runwayM: 1320, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YKER', name: 'Kerang Airport', state: 'VIC', lat: -35.7514, lon: 143.938995, type: 'regional', runwayM: 1070, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YMBU', name: 'Maryborough Airport', state: 'VIC', lat: -37.0331, lon: 143.709, type: 'regional', runwayM: 1040, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YPOD', name: 'Portland Airport', state: 'VIC', lat: -38.3181, lon: 141.470993, type: 'regional', runwayM: 1620, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YSLK', name: 'Sea Lake Airport', state: 'VIC', lat: -35.530594, lon: 142.889879, type: 'regional', runwayM: 1040, surface: 'unknown', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YSTA', name: 'Saint Arnaud Airport', state: 'VIC', lat: -36.6367, lon: 143.186005, type: 'regional', runwayM: 1000, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YSWH', name: 'Swan Hill Airport', state: 'VIC', lat: -35.375801, lon: 143.533005, type: 'regional', runwayM: 1500, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YSWL', name: 'Stawell Airport', state: 'VIC', lat: -37.071701, lon: 142.740997, type: 'regional', runwayM: 1400, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YWBL', name: 'Warrnambool Airport', state: 'VIC', lat: -38.2953, lon: 142.447006, type: 'regional', runwayM: 1370, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YWKB', name: 'Warracknabeal Airport', state: 'VIC', lat: -36.321098, lon: 142.419006, type: 'regional', runwayM: 1370, surface: 'sealed', lighted: true, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
  { icao: 'YWYF', name: 'Wycheproof Airport', state: 'VIC', lat: -36.0583, lon: 143.242996, type: 'regional', runwayM: 1030, surface: 'unknown', lighted: false, fuelTypes: ['AVGAS', 'JETA'], fuelPriceMult: 1.1 },
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
  // Northern Territory bush strips, matched against an installed MSFS scenery
  // addon pack (sltcreations "Northern Territory") whose own documentation
  // (not OurAirports — most of these predate or postdate its coverage, or
  // carry unmapped/inconsistent surface codes there) gives real placed
  // coordinates and runway lengths — coordinates and lengths are facts, not
  // the pack's expression, so no separate licence applies. Surface stays
  // 'unknown' unless that documentation states a material outright
  // (sand/dirt/gravel); every entry below has a documented length. A close
  // cluster of duplicate/nearby entries was thinned to satisfy the 12 nm
  // separation rule below, preferring — in order — a verified surface, a
  // longer runway, a better surface material, lighting, a non-private field,
  // then a non-WW2 field.
  { icao: 'YALR', name: 'Aileron Roadhouse', state: 'NT', lat: -22.653, lon: 133.347, type: 'strip', runwayM: 1288, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YANL', name: 'Anthony Lagoon Homestead', state: 'NT', lat: -17.976, lon: 135.539, type: 'strip', runwayM: 1102, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YARP', name: 'Arapunya', state: 'NT', lat: -22.285, lon: 135.726, type: 'strip', runwayM: 620, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YBES', name: 'Beswick', state: 'NT', lat: -14.591, lon: 133.111, type: 'strip', runwayM: 1145, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YBIG', name: 'Bing Bong', state: 'NT', lat: -15.62, lon: 136.353, type: 'strip', runwayM: 250, surface: 'sand', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YBIT', name: 'Bullita', state: 'NT', lat: -16.119, lon: 130.429, type: 'strip', runwayM: 960, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YCCR', name: 'Coomalie Creek WW2', state: 'NT', lat: -13.012, lon: 131.13, type: 'strip', runwayM: 1659, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YCNP', name: 'Channel Point', state: 'NT', lat: -13.155, lon: 130.144, type: 'strip', runwayM: 1355, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YCNS', name: 'Coniston Station', state: 'NT', lat: -22.05, lon: 132.494, type: 'strip', runwayM: 1327, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YDLD', name: 'Delmore Downs Homestead', state: 'NT', lat: -22.455, lon: 134.825, type: 'strip', runwayM: 1274, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YDPR', name: 'Dneiper', state: 'NT', lat: -22.627, lon: 135.232, type: 'strip', runwayM: 1700, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YDRY', name: 'Drysdale Island', state: 'NT', lat: -11.645, lon: 136.028, type: 'strip', runwayM: 715, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YDSV', name: 'Dorisvale', state: 'NT', lat: -14.501, lon: 131.347, type: 'strip', runwayM: 1290, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YELZ', name: 'Elizabeth Downs', state: 'NT', lat: -13.744, lon: 130.505, type: 'strip', runwayM: 1300, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YFSR', name: 'Fisher', state: 'NT', lat: -13.556, lon: 132.626, type: 'strip', runwayM: 1022, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YGOR', name: 'Gorrie WW2', state: 'NT', lat: -15.486, lon: 133.179, type: 'strip', runwayM: 1908, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YGTC', name: 'Gemtree Roadhouse', state: 'NT', lat: -22.971, lon: 134.247, type: 'strip', runwayM: 1350, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YHBP', name: 'Homebush Park', state: 'NT', lat: -14.662, lon: 132.645, type: 'strip', runwayM: 1788, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YHOV', name: 'Hodgson River Homestead', state: 'NT', lat: -15.571, lon: 134.096, type: 'strip', runwayM: 836, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YHSB', name: 'Horseshoe Bend', state: 'NT', lat: -25.256, lon: 134.28, type: 'strip', runwayM: 1573, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YKAB', name: 'King Ash Bay', state: 'NT', lat: -15.929, lon: 136.487, type: 'strip', runwayM: 977, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YKOH', name: 'Koolpinyah', state: 'NT', lat: -12.392, lon: 131.226, type: 'strip', runwayM: 1445, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YLAE', name: 'Labelle Downs', state: 'NT', lat: -13.113, lon: 130.499, type: 'strip', runwayM: 1120, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YLIT', name: 'Litchfield Station', state: 'NT', lat: -13.434, lon: 130.501, type: 'strip', runwayM: 1211, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YMEE', name: 'Merlin Diamond Mine', state: 'NT', lat: -16.818, lon: 136.329, type: 'strip', runwayM: 2438, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YMJI', name: 'Murranji Station', state: 'NT', lat: -17.005, lon: 133.133, type: 'strip', runwayM: 1109, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YMKC', name: 'Mistake Creek', state: 'NT', lat: -17.092, lon: 129.046, type: 'strip', runwayM: 815, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YNCW', name: 'Newcastle Waters', state: 'NT', lat: -17.335, lon: 133.44, type: 'strip', runwayM: 2120, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YWNR', name: 'Woolner', state: 'NT', lat: -12.364, lon: 131.467, type: 'strip', runwayM: 848, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YWOU', name: 'Wombungi', state: 'NT', lat: -14.776, lon: 131.047, type: 'strip', runwayM: 770, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX01', name: 'Dundee Beach', state: 'NT', lat: -12.72, lon: 130.361, type: 'strip', runwayM: 1382, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX05', name: 'Mary River Station', state: 'NT', lat: -13.49, lon: 132.014, type: 'strip', runwayM: 878, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX07', name: 'Cape Wessel', state: 'NT', lat: -11.004, lon: 136.76, type: 'strip', runwayM: 460, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX08', name: 'Marrakai Road', state: 'NT', lat: -12.835, lon: 131.331, type: 'strip', runwayM: 1114, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX12', name: 'Colson Track', state: 'NT', lat: -25.474, lon: 136.61, type: 'strip', runwayM: 1644, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX13', name: 'Jinka Homestead', state: 'NT', lat: -22.935, lon: 135.733, type: 'strip', runwayM: 1515, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX14', name: 'Redgum Store', state: 'NT', lat: -22.258, lon: 134.967, type: 'strip', runwayM: 1024, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX16', name: 'Ilpurla', state: 'NT', lat: -24.313, lon: 132.71, type: 'strip', runwayM: 882, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX17', name: 'Mount Zeil Wilderness Park', state: 'NT', lat: -23.326, lon: 132.39, type: 'strip', runwayM: 1116, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX18', name: 'Milton Park Homestead', state: 'NT', lat: -23.358, lon: 133.003, type: 'strip', runwayM: 1310, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX19', name: 'Hamilton Downs', state: 'NT', lat: -23.507, lon: 133.261, type: 'strip', runwayM: 1256, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX21', name: 'Dunmarra Roadhouse', state: 'NT', lat: -16.672, lon: 133.41, type: 'strip', runwayM: 1200, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX22', name: 'Indiana Station', state: 'NT', lat: -23.312, lon: 135.451, type: 'strip', runwayM: 1098, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX23', name: 'Beetaloo Station', state: 'NT', lat: -17.225, lon: 133.791, type: 'strip', runwayM: 1198, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX26', name: 'Spirit Hills Station', state: 'NT', lat: -15.434, lon: 129.01, type: 'strip', runwayM: 988, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX27', name: 'Yambah Station', state: 'NT', lat: -23.131, lon: 133.824, type: 'strip', runwayM: 1570, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX28', name: 'Melaleuca Station', state: 'NT', lat: -12.489, lon: 131.834, type: 'strip', runwayM: 2000, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX29', name: 'Fish River Homestead', state: 'NT', lat: -14.188, lon: 130.881, type: 'strip', runwayM: 1028, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX30', name: 'Finnis River Homestead', state: 'NT', lat: -12.872, lon: 130.545, type: 'strip', runwayM: 881, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX33', name: 'Atula Homestead', state: 'NT', lat: -23.255, lon: 136.389, type: 'strip', runwayM: 1160, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX34', name: 'Phillip Creek', state: 'NT', lat: -19.273, lon: 134.129, type: 'strip', runwayM: 865, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX35', name: 'Dry River Station', state: 'NT', lat: -15.239, lon: 132.147, type: 'strip', runwayM: 1084, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX36', name: 'Deleye', state: 'NT', lat: -13.771, lon: 129.983, type: 'strip', runwayM: 1130, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX37', name: 'Scott Creek Station', state: 'NT', lat: -14.871, lon: 131.854, type: 'strip', runwayM: 1770, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX38', name: 'Fenton WW2', state: 'NT', lat: -13.621, lon: 131.339, type: 'strip', runwayM: 2090, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX41', name: 'Munmarlary Homestead', state: 'NT', lat: -12.467, lon: 132.554, type: 'strip', runwayM: 1034, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX42', name: 'Nourlangie Homestead', state: 'NT', lat: -12.767, lon: 132.65, type: 'strip', runwayM: 1342, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX44', name: 'Burrumburru', state: 'NT', lat: -17.761, lon: 137.802, type: 'strip', runwayM: 1250, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX45', name: 'Redbank Wollogorang', state: 'NT', lat: -17.469, lon: 137.922, type: 'strip', runwayM: 1200, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX48', name: 'Rombola Family Farms', state: 'NT', lat: -14.986, lon: 133.085, type: 'strip', runwayM: 1140, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX49', name: 'Mount Bundy Station', state: 'NT', lat: -13.232, lon: 131.138, type: 'strip', runwayM: 1030, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX52', name: 'Timber Creek Racetrack', state: 'NT', lat: -15.733, lon: 130.5, type: 'strip', runwayM: 1011, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX53', name: 'Cockatoo Lagoon', state: 'NT', lat: -15.957, lon: 129.044, type: 'strip', runwayM: 911, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX55', name: 'Kalala Homestead', state: 'NT', lat: -16.194, lon: 133.33, type: 'strip', runwayM: 957, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX56', name: 'Western Creek', state: 'NT', lat: -15.92, lon: 132.388, type: 'strip', runwayM: 1500, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX57', name: 'Old Delamere', state: 'NT', lat: -15.729, lon: 131.534, type: 'strip', runwayM: 1345, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX58', name: 'Broadmere', state: 'NT', lat: -16.451, lon: 135.204, type: 'strip', runwayM: 1124, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX60', name: 'Macdonald WW2', state: 'NT', lat: -13.752, lon: 131.72, type: 'strip', runwayM: 1562, surface: 'gravel', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YX62', name: 'Strauss WW2', state: 'NT', lat: -12.656, lon: 131.077, type: 'strip', runwayM: 1586, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  // Far North Queensland bush strips, matched against an installed MSFS
  // scenery addon pack (sltcreations "Queensland Airfields") whose own PDF
  // documentation gives placed coordinates — coordinates and lengths are
  // facts, not the pack's expression, so no separate licence applies. Only
  // two entries state a runway length in that text (YQ02, YQ03) and only one
  // states a surface (YQ02, dirt). YCYT/YLRS carry an OurAirports length but
  // an unmapped surface code. Everything else is length-unknown,
  // surface-unknown. YRLH (Riversleigh) is grouped here for its scenery-pack
  // source though it sits further west, in Gulf/Lawn Hill country.
  { icao: 'YBWL', name: 'Bramwell Station', state: 'QLD', lat: -12.1397, lon: 142.6143, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YCDW', name: 'Dallachy/Cardwell', state: 'QLD', lat: -18.1791, lon: 145.9504, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YCYT', name: 'Crystalbrook Station', state: 'QLD', lat: -17.3804, lon: 144.4503, type: 'strip', runwayM: 1100, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YLRS', name: 'New Laura', state: 'QLD', lat: -15.1828, lon: 144.3456, type: 'strip', runwayM: 1000, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ01', name: 'Cannibal Creek', state: 'QLD', lat: -16.2022, lon: 144.4637, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ02', name: 'Wonga Beach', state: 'QLD', lat: -16.3212, lon: 145.4219, type: 'strip', runwayM: 1100, surface: 'dirt', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ03', name: 'Bustard Downs', state: 'QLD', lat: -16.5739, lon: 145.1822, type: 'strip', runwayM: 550, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ04', name: 'Mount Dickson', state: 'QLD', lat: -15.4689, lon: 145.0582, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ05', name: 'Mount Mulligan', state: 'QLD', lat: -16.88, lon: 144.8969, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ06', name: 'Cabana Station', state: 'QLD', lat: -18.0284, lon: 144.0479, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ07', name: 'Knox Creek', state: 'QLD', lat: -14.0522, lon: 141.6819, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ08', name: 'Koah Private', state: 'QLD', lat: -16.8267, lon: 145.521, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ09', name: 'Port Stuart', state: 'QLD', lat: -14.0785, lon: 143.6329, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ10', name: 'Hurricane Station', state: 'QLD', lat: -16.5802, lon: 144.6555, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YQ11', name: 'Bathurst Head Outstation', state: 'QLD', lat: -14.4705, lon: 144.2474, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YRLH', name: 'Riversleigh', state: 'QLD', lat: -19.0288, lon: 138.7374, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
  { icao: 'YWSN', name: 'Woodstock Station', state: 'QLD', lat: -19.3589, lon: 142.7574, type: 'strip', runwayM: null, surface: 'unknown', lighted: false, fuelTypes: [], fuelPriceMult: 1.35 },
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
