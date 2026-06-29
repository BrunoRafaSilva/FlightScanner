import type {
  FlightOption,
  FlightSearchResponse,
  SearchHistoryItem,
} from "../types";
import { api } from "./client";

export interface FlightSearchParams {
  origin: string;
  destination: string;
  date: string;
  adults?: number;
  maxStops?: number;
  sortBy?: number;
  topN?: number;
}

export async function searchFlights(
  params: FlightSearchParams,
): Promise<FlightSearchResponse> {
  const { data } = await api.get<FlightSearchResponse>("/flight-search", {
    params: {
      origin: params.origin.toUpperCase(),
      destination: params.destination.toUpperCase(),
      date: params.date,
      adults: params.adults ?? 1,
      topN: params.topN ?? 10,
    },
  });
  return data;
}

export async function getSearchHistory(limit = 20): Promise<SearchHistoryItem[]> {
  const { data } = await api.get<{ history: SearchHistoryItem[] }>(
    "/flight-search/history",
    { params: { limit } },
  );
  return data.history;
}

export interface TicketSearchResponse {
  ticketId: string;
  count: number;
  results: FlightOption[];
}

/** Search previously-cached flights by flight number (e.g. DL105). */
export async function searchByTicketId(
  ticketId: string,
): Promise<TicketSearchResponse> {
  const { data } = await api.get<TicketSearchResponse>(
    "/flight-search/by-ticket",
    { params: { ticketId } },
  );
  return data;
}
