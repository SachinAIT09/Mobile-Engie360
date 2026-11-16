/**
 * Seed figures for the ENGIE demo: Dutch grid areas, postcode districts and the Net2Grid EV picture.
 * Illustrative numbers in the spirit of Net2Grid's anonymised visibility pilots; shown as "Sample data".
 */
import { BRAND } from '@engie/shared';

export type Congestion = 'NONE' | 'WATCH' | 'CONGESTED';

export interface GridAreaSpec {
  code: string;
  name: string;
  /** Province. */
  region: string;
  operator: 'Stedin' | 'Liander' | 'Enexis';
  /** Detected EVs among ENGIE customers, % of them in Slim Laden, EV penetration %. */
  evs: number;
  knownPct: number;
  penetrationPct: number;
  congestion: Congestion;
  /** Postcode districts (PC4) with a neighbourhood name. */
  districts: [string, string][];
}

export const GRID_AREAS: GridAreaSpec[] = [
  {
    code: 'UT-OOST', name: 'Utrecht-Oost', region: 'Utrecht', operator: 'Stedin', evs: 463, knownPct: 48, penetrationPct: 15.3, congestion: 'CONGESTED',
    districts: [['3581', 'Oudwijk'], ['3582', 'Wittevrouwen'], ['3583', 'Abstede'], ['3584', 'Science Park'], ['3585', 'Rijnsweerd'], ['3571', 'Tuindorp'], ['3572', 'Voordorp']],
  },
  {
    code: 'AMS-ZUID', name: 'Amsterdam-Zuid', region: 'Noord-Holland', operator: 'Liander', evs: 436, knownPct: 52, penetrationPct: 21.7, congestion: 'CONGESTED',
    districts: [['1071', 'Museumkwartier'], ['1072', 'De Pijp'], ['1073', 'Oude Pijp'], ['1075', 'Willemspark'], ['1076', 'Buitenveldert'], ['1077', 'Apollobuurt'], ['1078', 'Rivierenbuurt'], ['1079', 'Scheldebuurt'], ['1081', 'Zuidas']],
  },
  {
    code: 'EHV-NOORD', name: 'Eindhoven-Noord', region: 'Noord-Brabant', operator: 'Enexis', evs: 342, knownPct: 46, penetrationPct: 17.5, congestion: 'WATCH',
    districts: [['5611', 'Centrum'], ['5612', 'Woensel-West'], ['5613', 'Vaartbroek'], ['5614', 'Tongelre'], ['5615', 'Strijp'], ['5616', 'Woensel-Zuid'], ['5621', 'Achtse Barrier'], ['5622', 'Kronehoef']],
  },
  {
    code: 'AMF', name: 'Amersfoort', region: 'Utrecht', operator: 'Stedin', evs: 273, knownPct: 59, penetrationPct: 16.7, congestion: 'WATCH',
    districts: [['3811', 'Binnenstad'], ['3812', 'Soesterkwartier'], ['3813', 'Leusderkwartier'], ['3814', 'Bergkwartier'], ['3815', 'Schuilenburg'], ['3816', 'Kruiskamp']],
  },
  {
    code: 'RTD-NOORD', name: 'Rotterdam-Noord', region: 'Zuid-Holland', operator: 'Stedin', evs: 246, knownPct: 58, penetrationPct: 15.9, congestion: 'NONE',
    districts: [['3031', 'Oude Noorden'], ['3032', 'Liskwartier'], ['3033', 'Agniesebuurt'], ['3034', 'Bergpolder'], ['3035', 'Blijdorp'], ['3036', 'Provenierswijk']],
  },
  {
    code: 'HLM', name: 'Haarlem', region: 'Noord-Holland', operator: 'Liander', evs: 245, knownPct: 51, penetrationPct: 34.2, congestion: 'WATCH',
    districts: [['2011', 'Centrum'], ['2012', 'Kleverpark'], ['2013', 'Vijfhoek'], ['2014', 'Koninginnebuurt'], ['2015', 'Bloemendaal-grens']],
  },
  {
    code: 'DH-WEST', name: 'Den Haag-West', region: 'Zuid-Holland', operator: 'Stedin', evs: 202, knownPct: 42, penetrationPct: 14.1, congestion: 'NONE',
    districts: [['2551', 'Bohemen'], ['2552', 'Waldeck'], ['2553', 'Kijkduin'], ['2554', 'Loosduinen'], ['2555', 'Ockenburgh'], ['2561', 'Duinoord']],
  },
  {
    code: 'NMG', name: 'Nijmegen', region: 'Gelderland', operator: 'Liander', evs: 139, knownPct: 60, penetrationPct: 12.2, congestion: 'NONE',
    districts: [['6511', 'Centrum'], ['6512', 'Bottendaal'], ['6521', 'Hengstdal'], ['6522', 'Bottendaal-Oost'], ['6523', 'Altrade']],
  },
  {
    code: 'ZWL', name: 'Zwolle', region: 'Overijssel', operator: 'Enexis', evs: 122, knownPct: 37, penetrationPct: 8.4, congestion: 'WATCH',
    districts: [['8011', 'Binnenstad'], ['8012', 'Assendorp'], ['8013', 'Wipstrik'], ['8014', 'Berkum']],
  },
  {
    code: 'GRN', name: 'Groningen', region: 'Groningen', operator: 'Enexis', evs: 109, knownPct: 47, penetrationPct: 15.7, congestion: 'NONE',
    districts: [['9711', 'Binnenstad'], ['9712', 'Schildersbuurt'], ['9713', 'Oranjewijk']],
  },
  {
    code: 'ALM', name: 'Almere', region: 'Flevoland', operator: 'Liander', evs: 100, knownPct: 21, penetrationPct: 24.2, congestion: 'CONGESTED',
    districts: [['1311', 'Stad-Centrum'], ['1312', 'Muziekwijk'], ['1313', 'Filmwijk'], ['1314', 'Waterwijk']],
  },
  {
    code: 'BRD', name: 'Breda', region: 'Noord-Brabant', operator: 'Enexis', evs: 95, knownPct: 62, penetrationPct: 10, congestion: 'NONE',
    districts: [['4811', 'Centrum'], ['4812', 'Belcrum'], ['4813', 'Ginneken']],
  },
  {
    code: 'LDN', name: 'Leiden', region: 'Zuid-Holland', operator: 'Liander', evs: 92, knownPct: 60, penetrationPct: 18.4, congestion: 'NONE',
    districts: [['2311', 'Binnenstad'], ['2312', 'Pieterswijk'], ['2313', 'Professorenwijk']],
  },
  {
    code: 'DLF', name: 'Delft', region: 'Zuid-Holland', operator: 'Stedin', evs: 79, knownPct: 30, penetrationPct: 20.8, congestion: 'WATCH',
    districts: [['2611', 'Centrum'], ['2612', 'Hof van Delft'], ['2613', 'Wippolder']],
  },
  {
    code: 'HLV', name: 'Hilversum', region: 'Noord-Holland', operator: 'Liander', evs: 62, knownPct: 39, penetrationPct: 32.5, congestion: 'NONE',
    districts: [['1211', 'Centrum'], ['1212', 'Trompenberg']],
  },
  {
    code: 'ZST', name: 'Zeist', region: 'Utrecht', operator: 'Stedin', evs: 60, knownPct: 55, penetrationPct: 24.1, congestion: 'NONE',
    districts: [['3701', 'Centrum'], ['3702', 'Lyceumkwartier']],
  },
  {
    code: 'BSD', name: 'Bussum', region: 'Noord-Holland', operator: 'Liander', evs: 17, knownPct: 12, penetrationPct: 35.4, congestion: 'NONE',
    districts: [['1401', 'Centrum']],
  },
  {
    code: 'WGN', name: 'Wageningen', region: 'Gelderland', operator: 'Liander', evs: 16, knownPct: 19, penetrationPct: 20, congestion: 'NONE',
    districts: [['6701', 'Centrum']],
  },
];

/** Areas where ENGIE customers show no EV signal yet: [code, name, operator, districts, homes]. */
export const DEAD_GRID_AREAS: [string, string, string, number, number][] = [
  ['DRT', 'Dordrecht-Zuid', 'Stedin', 2, 2],
  ['ASN', 'Assen-Oost', 'Enexis', 1, 4],
  ['LWD', 'Leeuwarden-Noord', 'Liander', 2, 3],
  ['VLS', 'Vlissingen', 'Enexis', 1, 1],
  ['HRL', 'Heerlen-Zuid', 'Enexis', 1, 3],
  ['DVT', 'Deventer-West', 'Enexis', 1, 2],
];

export interface LiveDistrictSpec {
  known: number;
  unenrolled: number;
  premises: number;
  /** Customers without an EV, for the installment and other non-EV segments. */
  others?: number;
  /** Enrolled EVs also detected by Net2Grid. Default round(known × 0.78). */
  confirmed?: number;
  /** Ground-truth validated EVs. Default round(evs × 0.15). */
  groundTruth?: number;
}

/**
 * Districts with per-customer data. Utrecht-Oost is fully live; the other entries are the worst
 * segments elsewhere, so their Target buttons produce a real audience.
 */
export const LIVE_DISTRICTS: Record<string, LiveDistrictSpec> = {
  '3581': { known: 69, unenrolled: 77, premises: 665, others: 140, confirmed: 54, groundTruth: 23 },
  '3582': { known: 46, unenrolled: 44, premises: 650, others: 90 },
  '3583': { known: 38, unenrolled: 35, premises: 500, others: 70 },
  '3584': { known: 15, unenrolled: 34, premises: 460, others: 50 },
  '3585': { known: 23, unenrolled: 21, premises: 300, others: 40 },
  '3571': { known: 19, unenrolled: 19, premises: 250, others: 35 },
  '3572': { known: 12, unenrolled: 11, premises: 170, others: 25 },
  '1401': { known: 2, unenrolled: 15, premises: 48 },
  '2611': { known: 2, unenrolled: 13, premises: 80 },
  '1312': { known: 5, unenrolled: 28, premises: 143 },
  '1313': { known: 5, unenrolled: 24, premises: 103 },
  '6701': { known: 3, unenrolled: 13, premises: 80 },
  '8011': { known: 10, unenrolled: 23, premises: 355 },
  '1311': { known: 11, unenrolled: 25, premises: 148 },
};

/** Grid area a district belongs to. */
export const DISTRICT_AREA: Record<string, string> = Object.fromEntries(
  GRID_AREAS.flatMap((g) => g.districts.map(([pc]) => [pc, g.code])),
);
export const DISTRICT_NAME: Record<string, string> = Object.fromEntries(
  GRID_AREAS.flatMap((g) => g.districts.map(([pc, name]) => [pc, name])),
);
export const AREA_BY_CODE: Record<string, GridAreaSpec> = Object.fromEntries(GRID_AREAS.map((g) => [g.code, g]));

/** Headline figures, which live districts adjust by their deltas. */
export const HEADLINE = {
  customers: 48210,
  onDynamic: 9640,
  installmentGapCustomers: 6130,
  avgInstallmentGap: 14,
  heatPumps: 2875,
  knownEvs: 1726,
  unenrolledEvs: 1770,
  matchedPremises: 21257,
  noSignalPremises: 17761,
  noLocationPremises: 458,
  partiallyDeadGridAreas: 5,
  deadDistricts: 8,
  deadDistrictPremises: 15,
  dataSourceNote: `${BRAND.partners.disaggregation} appliance recognition on ENGIE smart-meter data, anonymised. Shown as sample data.`,
};

export const FIRST_NAMES = [
  'Emma', 'Daan', 'Julia', 'Sem', 'Mila', 'Lucas', 'Tess', 'Levi', 'Sophie', 'Finn', 'Zoë', 'Milan', 'Sara', 'Noah',
  'Anna', 'Liam', 'Eva', 'Luuk', 'Lotte', 'Jesse', 'Fleur', 'Thijs', 'Noor', 'Bram', 'Yara', 'Ruben', 'Fatima', 'Mohammed',
  'Lisa', 'Jan', 'Iris', 'Stijn', 'Femke', 'Koen', 'Anouk', 'Mehmet', 'Priya', 'Wouter', 'Esther', 'Joris',
];
export const LAST_NAMES = [
  'de Jong', 'Jansen', 'de Vries', 'van den Berg', 'van Dijk', 'Bakker', 'Janssen', 'Visser', 'Smit', 'Meijer', 'de Boer',
  'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen', 'Dekker', 'Brouwer', 'de Wit', 'Dijkstra',
  'Smits', 'de Graaf', 'van der Meer', 'Kok', 'Jacobs', 'Yilmaz', 'El Amrani', 'Vermeulen',
];
export const STREETS = [
  'Lindelaan', 'Burgemeester Reigerstraat', 'Biltstraat', 'Wittevrouwenkade', 'Maliesingel', 'Oudwijkerdwarsstraat',
  'Notebomenlaan', 'Abstederdijk', 'Koningsweg', 'Waterstraat', 'Kerkstraat', 'Molenweg', 'Stationsweg', 'Parkweg',
  'Julianalaan', 'Emmalaan', 'Wilhelminapark', 'Johannes de Bekelaan', 'Prins Hendriklaan', 'Van Lieflandlaan',
];
export const HOME_TYPES = [
  { en: 'Terraced house, 1978', nl: 'Tussenwoning, 1978' },
  { en: 'Corner house, 1965', nl: 'Hoekwoning, 1965' },
  { en: 'Apartment, 1932', nl: 'Bovenwoning, 1932' },
  { en: 'Semi-detached, 2004', nl: 'Twee-onder-een-kap, 2004' },
  { en: 'Apartment, 2015', nl: 'Appartement, 2015' },
];
export const TOWN: string = BRAND.demoTown;
