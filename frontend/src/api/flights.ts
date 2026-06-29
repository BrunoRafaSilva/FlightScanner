import type { Flight, FlightInput } from "../types";
import { api } from "./client";

export async function listFlights(): Promise<Flight[]> {
  const { data } = await api.get<Flight[]>("/flights");
  return data;
}

export async function getFlight(id: number): Promise<Flight> {
  const { data } = await api.get<Flight>(`/flights/${id}`);
  return data;
}

export async function createFlight(input: FlightInput): Promise<Flight> {
  const { data } = await api.post<Flight>("/flights", input);
  return data;
}

export async function updateFlight(
  id: number,
  input: Partial<FlightInput>,
): Promise<Flight> {
  const { data } = await api.put<Flight>(`/flights/${id}`, input);
  return data;
}

export async function deleteFlight(id: number): Promise<void> {
  await api.delete(`/flights/${id}`);
}
