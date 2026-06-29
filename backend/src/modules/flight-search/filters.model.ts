import type { FlightSearchFilters } from "./models";

/**
 * Encodes search filters into the deeply-nested array shape Google Flights'
 * internal `GetShoppingResults` endpoint expects. Ported verbatim from the
 * `fli` library's FlightSearchFiltersModel.format/encode, with one change:
 * airports/airlines are passed through as raw IATA codes instead of being
 * round-tripped through a hardcoded enum, so any airport/airline works.
 */
export class FlightSearchFiltersModel {
  constructor(private readonly filters: FlightSearchFilters) {}

  format(): unknown[] {
    const f = this.filters;

    const formattedSegments = f.flightSegments.map((segment) => {
      const departureAirports = segment.departureAirport.map(([code, meta]) => [code, meta]);
      const arrivalAirports = segment.arrivalAirport.map(([code, meta]) => [code, meta]);

      const timeFilters = segment.timeRestrictions
        ? [
            segment.timeRestrictions.earliestDeparture ?? null,
            segment.timeRestrictions.latestDeparture ?? null,
            segment.timeRestrictions.earliestArrival ?? null,
            segment.timeRestrictions.latestArrival ?? null,
          ]
        : null;

      const airlinesFilters =
        f.airlines && f.airlines.length > 0 ? [...f.airlines].sort() : null;

      const layoverAirports = f.layoverRestrictions?.airports ?? null;
      const layoverDuration = f.layoverRestrictions?.maxDuration ?? null;

      return [
        [departureAirports], // departure airport
        [arrivalAirports], // arrival airport
        timeFilters, // time restrictions
        f.stops, // stops
        airlinesFilters, // airlines
        null,
        segment.travelDate, // travel date
        f.maxDuration ? [f.maxDuration] : null,
        null, // selected flight (round-trip only)
        layoverAirports,
        null,
        null,
        layoverDuration,
        null,
        3, // constant
      ];
    });

    return [
      [],
      [
        null,
        null,
        f.tripType,
        null,
        [],
        f.seatType,
        [
          f.passengerInfo.adults,
          f.passengerInfo.children,
          f.passengerInfo.infantsOnLap,
          f.passengerInfo.infantsInSeat,
        ],
        f.priceLimit ? [null, f.priceLimit.maxPrice] : null,
        null,
        null,
        null,
        null,
        null,
        formattedSegments,
        null,
        null,
        null,
        1,
      ],
      f.sortBy,
      0,
      0,
      2,
    ];
  }

  encode(): string {
    const formattedJson = JSON.stringify(this.format());
    const wrappedFilters = [null, formattedJson];
    return encodeURIComponent(JSON.stringify(wrappedFilters));
  }
}
