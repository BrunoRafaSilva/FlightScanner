import { beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../src/database/migrate";
import { seedReferenceData } from "../src/database/reference-seed";
import { getAirlineName, getAirport } from "../src/modules/flight-search/reference-data";

// Lookups read from SQLite, so make sure the reference tables are populated.
beforeAll(() => {
  runMigrations();
  seedReferenceData();
});

describe("getAirlineName", () => {
  it("applies curated overrides for collided IATA codes", () => {
    expect(getAirlineName("G3")).toBe("Gol Linhas Aéreas");
    expect(getAirlineName("LA")).toBe("LATAM Airlines");
    expect(getAirlineName("AD")).toBe("Azul Brazilian Airlines");
  });

  it("resolves a non-collided airline from the CSV", () => {
    // AA = American Airlines in the dataset.
    expect(getAirlineName("AA")).toMatch(/American/i);
  });

  it("falls back to the raw code for unknown airlines", () => {
    expect(getAirlineName("X8")).toBe("X8"); // not present in the dataset
  });
});

describe("getAirport", () => {
  it("resolves major airports with city + country", () => {
    const gru = getAirport("GRU");
    expect(gru?.city).toBe("São Paulo");
    expect(gru?.country).toBe("BR");
  });

  it("prefers the large airport when an IATA code collides", () => {
    // GIG is reused by a tiny Canadian strip and Rio de Janeiro/Galeão.
    expect(getAirport("GIG")?.country).toBe("BR");
  });

  it("returns undefined for unknown codes", () => {
    expect(getAirport("ZZZ")).toBeUndefined();
  });
});
