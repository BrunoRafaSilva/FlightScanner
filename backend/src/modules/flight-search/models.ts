/**
 * Google Flights search models — ported from the `fli` library's
 * models/google-flights/base.ts. These enums map directly to the magic numbers
 * Google's internal GetShoppingResults endpoint expects in the encoded request.
 */

export const SeatType = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 2,
  BUSINESS: 3,
  FIRST: 4,
} as const;
export type SeatType = (typeof SeatType)[keyof typeof SeatType];

export const SortBy = {
  NONE: 0,
  TOP_FLIGHTS: 1,
  CHEAPEST: 2,
  DEPARTURE_TIME: 3,
  ARRIVAL_TIME: 4,
  DURATION: 5,
} as const;
export type SortBy = (typeof SortBy)[keyof typeof SortBy];

export const TripType = {
  ROUND_TRIP: 1,
  ONE_WAY: 2,
} as const;
export type TripType = (typeof TripType)[keyof typeof TripType];

export const MaxStops = {
  ANY: 0,
  NON_STOP: 1,
  ONE_STOP_OR_FEWER: 2,
  TWO_OR_FEWER_STOPS: 3,
} as const;
export type MaxStops = (typeof MaxStops)[keyof typeof MaxStops];

export interface PassengerInfo {
  adults: number;
  children: number;
  infantsInSeat: number;
  infantsOnLap: number;
}

/** `[IATA code, metadata]` — metadata 0 = airport (vs city). */
export type AirportSelection = [string, number];

export interface FlightSegment {
  /** Origin airports for this leg (usually one). */
  departureAirport: AirportSelection[];
  /** Destination airports for this leg. */
  arrivalAirport: AirportSelection[];
  /** Travel date as `YYYY-MM-DD`. */
  travelDate: string;
  timeRestrictions?: {
    earliestDeparture?: number | null;
    latestDeparture?: number | null;
    earliestArrival?: number | null;
    latestArrival?: number | null;
  };
}

export interface FlightSearchFilters {
  tripType: TripType;
  passengerInfo: PassengerInfo;
  flightSegments: FlightSegment[];
  stops: MaxStops;
  seatType: SeatType;
  sortBy: SortBy;
  airlines?: string[] | null;
  maxDuration?: number | null;
  priceLimit?: { maxPrice: number } | null;
  layoverRestrictions?: { airports?: string[] | null; maxDuration?: number | null } | null;
}

/** A single flight leg in a parsed itinerary. */
export interface FlightLeg {
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  /** City of the departure airport (from the airports dataset), if known. */
  departureCity: string | null;
  arrivalCity: string | null;
  departureDateTime: string; // ISO
  arrivalDateTime: string; // ISO
  durationMinutes: number;
}

/** A parsed itinerary (one search result). */
export interface FlightOption {
  price: number;
  durationMinutes: number;
  stops: number;
  /** True when the marketing carrier is a preferred/priority airline. */
  priority: boolean;
  legs: FlightLeg[];
}
