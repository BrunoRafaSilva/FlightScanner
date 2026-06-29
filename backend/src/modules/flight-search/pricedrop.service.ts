import type { Flight } from "../../database/schema";
import { searchFlightsCached } from "./cache.service";

export interface PriceDropResult {
  /** Whether we found the registered flight in current results. */
  matched: boolean;
  paidPrice: number | null;
  currentPrice: number | null;
  /** True when a paid price is known and the current price is lower. */
  dropped: boolean;
  /** paidPrice − currentPrice when dropped, else 0. */
  refund: number;
  matchedFlightNumbers: string[];
  legCount: number;
  message: string;
}

/** "HH:MM" (UTC) of an ISO timestamp, or null. Both registered flights and live
 *  results are parsed the same way, so their times line up for the same flight. */
function hourMinute(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "");
const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Live price-drop check. Searches the flight's route+date right now, finds the
 * itinerary that matches the registered flight number (and, preferably,
 * departure time), and compares its current price to the price the user paid.
 */
export async function checkFlightPriceDrop(
  userId: number,
  flight: Flight,
): Promise<PriceDropResult> {
  const paidPrice = flight.price ?? null;
  const dateOnly = (flight.departureDate ?? "").slice(0, 10); // YYYY-MM-DD

  const search = await searchFlightsCached(userId, {
    origin: flight.departureAirport,
    destination: flight.arrivalAirport,
    date: dateOnly,
    topN: 50,
  });

  const wantNumber = norm(flight.flightNumber ?? "");
  const wantHour = hourMinute(flight.departureDate);

  // Match itineraries whose first (marketing) leg is the registered flight.
  const candidates = search.results.filter(
    (o) => o.legs[0] && norm(o.legs[0].flightNumber) === wantNumber,
  );
  const match =
    candidates.find((o) => hourMinute(o.legs[0].departureDateTime) === wantHour) ??
    candidates[0];

  if (!match) {
    return {
      matched: false,
      paidPrice,
      currentPrice: null,
      dropped: false,
      refund: 0,
      matchedFlightNumbers: [],
      legCount: 0,
      message:
        "We couldn't find this exact flight in the current results. Please attach a screenshot proving the price you paid.",
    };
  }

  const currentPrice = match.price;
  const matchedFlightNumbers = match.legs.map((l) => l.flightNumber);
  const legCount = match.legs.length;

  if (paidPrice == null) {
    return {
      matched: true,
      paidPrice: null,
      currentPrice,
      dropped: false,
      refund: 0,
      matchedFlightNumbers,
      legCount,
      message: `Current price is US$${currentPrice}, but no paid price is saved on this flight. Add the price you paid (on the flight) to compare.`,
    };
  }

  const dropped = currentPrice < paidPrice;
  const refund = dropped ? money(paidPrice - currentPrice) : 0;

  return {
    matched: true,
    paidPrice,
    currentPrice,
    dropped,
    refund,
    matchedFlightNumbers,
    legCount,
    message: dropped
      ? `The price we found (US$${currentPrice}) is LESS than you paid (US$${paidPrice}). You may be owed US$${refund}. Please attach a screenshot of your original booking price.`
      : `No drop: the current price (US$${currentPrice}) is not lower than what you paid (US$${paidPrice}).`,
  };
}
