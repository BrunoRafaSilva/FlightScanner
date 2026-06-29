export type FlightStatus = "SCHEDULED" | "DELAYED" | "CANCELLED" | "COMPLETED";

export type ClaimType =
  | "PRICE_DROP"
  | "DELAY"
  | "CANCELLATION"
  | "DENIED_BOARDING"
  | "BAGGAGE";

export type ClaimStatus =
  | "DRAFT"
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "READY_TO_SUBMIT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PAID";

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
}

export interface Flight {
  id: number;
  userId: number;
  airlineName: string;
  flightNumber: string;
  bookingReference: string | null;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  arrivalDate: string | null;
  delayMinutes: number;
  status: FlightStatus;
  price: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriceDrop {
  matched: boolean;
  paidPrice: number | null;
  currentPrice: number | null;
  dropped: boolean;
  refund: number;
  matchedFlightNumbers: string[];
  legCount: number;
  message: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  estimatedCompensation: number;
  rule: string;
  priceDrop?: PriceDrop;
}

export interface ClaimDocument {
  id: number;
  claimId: number;
  fileName: string;
  fileType: string | null;
  fileUrl: string | null;
  createdAt: string;
}

export interface ClaimEvent {
  id: number;
  claimId: number;
  status: ClaimStatus;
  notes: string | null;
  createdAt: string;
}

export interface Claim {
  id: number;
  userId: number;
  flightId: number;
  claimType: ClaimType;
  status: ClaimStatus;
  description: string | null;
  eligibilityResult: EligibilityResult | null;
  estimatedCompensation: number | null;
  generatedLetter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimWithFlight extends Claim {
  flight: Flight | null;
}

export interface ClaimDetail extends Claim {
  flight: Flight | null;
  events: ClaimEvent[];
}

export interface Airport {
  iata: string;
  name: string;
  municipality: string | null;
  country: string | null;
}

// --- Flight search (Google Flights) ---

export interface FlightSearchLeg {
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureCity: string | null;
  arrivalCity: string | null;
  departureDateTime: string; // ISO
  arrivalDateTime: string; // ISO
  durationMinutes: number;
}

export interface FlightOption {
  price: number;
  durationMinutes: number;
  stops: number;
  /** True when the marketing carrier is a preferred/priority airline. */
  priority: boolean;
  legs: FlightSearchLeg[];
}

export interface FlightSearchResponse {
  origin: string;
  destination: string;
  date: string;
  adults: number;
  count: number;
  /** true → these results were reused from a cached snapshot (< TTL old). */
  cached: boolean;
  /** id of the cached results snapshot ("Redis"-style key). */
  searchResultsId: number;
  /** id of the history row recorded for this search. */
  searchId: number;
  results: FlightOption[];
}

export interface SearchHistoryItem {
  searchId: number;
  searchResultsId: number;
  origin: string;
  destination: string;
  date: string;
  adults: number;
  cached: boolean;
  resultCount: number | null;
  createdAt: string;
}

export interface FlightInput {
  airlineName: string;
  flightNumber: string;
  bookingReference?: string | null;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  arrivalDate?: string | null;
  delayMinutes?: number;
  status?: FlightStatus;
  price?: number | null;
}
