import { env } from "../../env";
import { FlightSearchFiltersModel } from "./filters.model";
import { getAirlineName, getAirport, isPriorityAirline } from "./reference-data";
import {
  MaxStops,
  SeatType,
  SortBy,
  TripType,
  type FlightOption,
  type FlightSearchFilters,
} from "./models";

const BASE_URL =
  "https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults";

/** High-level query coming from the API route. */
export interface FlightSearchQuery {
  origin: string; // IATA
  destination: string; // IATA
  date: string; // YYYY-MM-DD
  adults?: number;
  seatType?: SeatType;
  maxStops?: MaxStops;
  sortBy?: SortBy;
  topN?: number;
}

/** Translate a simple query into the full `fli` filter object (one-way). */
export function buildFilters(query: FlightSearchQuery): FlightSearchFilters {
  return {
    tripType: TripType.ONE_WAY,
    passengerInfo: {
      adults: query.adults ?? 1,
      children: 0,
      infantsInSeat: 0,
      infantsOnLap: 0,
    },
    flightSegments: [
      {
        departureAirport: [[query.origin.toUpperCase(), 0]],
        arrivalAirport: [[query.destination.toUpperCase(), 0]],
        travelDate: query.date,
      },
    ],
    stops: query.maxStops ?? MaxStops.ANY,
    seatType: query.seatType ?? SeatType.ECONOMY,
    sortBy: query.sortBy ?? SortBy.TOP_FLIGHTS,
  };
}

function parseDateTime(dateArr: unknown, timeArr: unknown): string {
  const d = Array.isArray(dateArr) ? (dateArr as (number | null)[]) : [];
  const t = Array.isArray(timeArr) ? (timeArr as (number | null)[]) : [];
  if (!d.some((x) => x != null) || !t.some((x) => x != null)) {
    throw new Error("missing date/time");
  }
  return new Date(
    d[0] || 0,
    (d[1] || 1) - 1,
    d[2] || 1,
    t[0] || 0,
    t[1] || 0,
  ).toISOString();
}

/** Parse a single itinerary node into a FlightOption. Throws on malformed data. */
export function parseFlightOption(data: any): FlightOption {
  const priceList = data[1][0];
  const price = priceList[priceList.length - 1];
  const legNodes = data[0][2] as any[];

  const legs = legNodes.map((fl) => {
    const code = String(fl[22][0]);
    const dep = String(fl[3]);
    const arr = String(fl[6]);
    return {
      airlineCode: code,
      airlineName: getAirlineName(code),
      flightNumber: `${code}${fl[22][1]}`,
      departureAirport: dep,
      arrivalAirport: arr,
      departureCity: getAirport(dep)?.city ?? null,
      arrivalCity: getAirport(arr)?.city ?? null,
      departureDateTime: parseDateTime(fl[20], fl[8]),
      arrivalDateTime: parseDateTime(fl[21], fl[10]),
      durationMinutes: Number(fl[11]) || 0,
    };
  });

  return {
    price: Number(price) || 0,
    durationMinutes: Number(data[0][9]) || 0,
    stops: legNodes.length - 1,
    // The marketing carrier is the first leg's airline.
    priority: legs.length > 0 ? isPriorityAirline(legs[0].airlineCode) : false,
    legs,
  };
}

/**
 * Pure parser for the raw `)]}'`-prefixed text Google returns. Kept separate
 * from the network call so it can be unit-tested against a saved sample. Skips
 * any itinerary that fails to parse rather than failing the whole search.
 */
export function parseShoppingResponse(rawText: string, topN = 5): FlightOption[] {
  let body = rawText.replace(/^\)\]\}'/, "").trimStart();
  // Some responses prefix a chunk-length integer line before the JSON array.
  if (!body.startsWith("[")) {
    const idx = body.indexOf("[");
    if (idx >= 0) body = body.slice(idx);
  }

  const top = JSON.parse(body);
  const parsed = top?.[0]?.[2];
  if (!parsed) return [];

  const encodedData = JSON.parse(parsed);
  const flightsData: any[] = [];
  for (const i of [2, 3]) {
    if (Array.isArray(encodedData[i]) && Array.isArray(encodedData[i][0])) {
      flightsData.push(...encodedData[i][0]);
    }
  }

  const options: FlightOption[] = [];
  for (const node of flightsData) {
    try {
      options.push(parseFlightOption(node));
    } catch {
      // skip malformed itinerary
    }
  }
  // Preferred airlines first, then cheapest. Sorting before the topN slice
  // guarantees priority itineraries aren't cut off.
  options.sort(
    (a, b) => Number(b.priority) - Number(a.priority) || a.price - b.price,
  );
  return options.slice(0, topN);
}

/**
 * Execute a REAL flight search against Google Flights' internal endpoint.
 * No simulated fallback — if Google blocks the request or changes its response
 * shape, this throws and the route surfaces the error.
 */
export async function searchFlights(query: FlightSearchQuery): Promise<FlightOption[]> {
  const encoded = new FlightSearchFiltersModel(buildFilters(query)).encode();

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "*/*",
    },
    body: `f.req=${encoded}`,
    signal: AbortSignal.timeout(env.flightSearch.timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Google Flights responded with HTTP ${res.status}`);
  }

  const text = await res.text();
  return parseShoppingResponse(text, query.topN ?? 5);
}
