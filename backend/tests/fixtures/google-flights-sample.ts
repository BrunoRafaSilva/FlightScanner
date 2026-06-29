/**
 * Builds a fake Google Flights `GetShoppingResults` raw response in the exact
 * `)]}'`-prefixed nested-array shape the live endpoint returns, so the pure
 * parser can be tested without the network. Index map matches
 * parseFlightOption in search.service.ts.
 */
function leg(
  airlineCode: string,
  flightNum: string,
  dep: string,
  arr: string,
  depDate: number[],
  depTime: number[],
  arrDate: number[],
  arrTime: number[],
  durMin: number,
): unknown[] {
  const fl: unknown[] = new Array(23).fill(null);
  fl[3] = dep;
  fl[6] = arr;
  fl[8] = depTime; // [hour, minute]
  fl[10] = arrTime;
  fl[11] = durMin;
  fl[20] = depDate; // [year, month, day]
  fl[21] = arrDate;
  fl[22] = [airlineCode, flightNum];
  return fl;
}

function flight(priceUSD: number, totalDurMin: number, legs: unknown[]): unknown[] {
  const f0: unknown[] = new Array(10).fill(null);
  f0[2] = legs; // legs array -> stops = length - 1
  f0[9] = totalDurMin;
  const f1 = [[null, priceUSD]]; // price = last element of data[1][0]
  return [f0, f1];
}

export function sampleResponse(dateStr = "2026-08-15"): string {
  const d = dateStr.split("-").map(Number);
  const date = [d[0], d[1], d[2]];

  const itineraries = [
    flight(312, 415, [
      leg("G3", "1573", "MCZ", "GRU", date, [6, 25], date, [9, 40], 195),
      leg("G3", "2045", "GRU", "IGU", date, [11, 10], date, [13, 20], 130),
    ]),
    flight(298, 430, [
      leg("LA", "3318", "MCZ", "CGH", date, [8, 50], date, [12, 15], 205),
      leg("LA", "4602", "CGH", "IGU", date, [14, 5], date, [16, 0], 115),
    ]),
    flight(341, 460, [
      leg("AD", "4112", "MCZ", "VCP", date, [5, 30], date, [9, 5], 215),
      leg("AD", "2789", "VCP", "IGU", date, [10, 40], date, [12, 50], 130),
    ]),
  ];

  const encodedData = [null, null, [itineraries], null];
  const outer = [["wrb.fr", null, JSON.stringify(encodedData)]];
  return ")]}'\n" + JSON.stringify(outer);
}
