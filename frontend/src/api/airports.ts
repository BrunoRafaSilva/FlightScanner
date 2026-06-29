import type { Airport } from "../types";
import { api } from "./client";

/** Type-ahead airport search (iata / city / name), accent-insensitive. */
export async function searchAirports(q: string, limit = 8): Promise<Airport[]> {
  if (!q.trim()) return [];
  const { data } = await api.get<{ airports: Airport[] }>("/airports", {
    params: { q, limit },
  });
  return data.airports;
}
