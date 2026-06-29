import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { env } from "../../env";
import { searchAirports, type AirportHit } from "./airports.service";

/**
 * Real gRPC service for airport search. Defined by airports.proto and run
 * in-process; the REST `/airports` route is a gRPC *client* of this service
 * (browsers can't speak raw gRPC, so a thin REST gateway fronts it). The
 * service could be split into its own microservice by changing the client
 * address — nothing else would change.
 */
const PROTO_PATH = fileURLToPath(new URL("./airports.proto", import.meta.url));
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proto = grpc.loadPackageDefinition(packageDef) as any;
const AirportService = proto.airports.AirportService;

interface SearchRequest {
  q: string;
  limit: number;
}

/** Start the gRPC server (resolves once it's bound and accepting calls). */
export function startAirportGrpcServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = new grpc.Server();
    server.addService(AirportService.service, {
      Search: (
        call: grpc.ServerUnaryCall<SearchRequest, { airports: AirportHit[] }>,
        callback: grpc.sendUnaryData<{ airports: AirportHit[] }>,
      ) => {
        try {
          const { q, limit } = call.request;
          const airports = searchAirports(
            q ?? "",
            limit && limit > 0 ? limit : 8,
          );
          callback(null, { airports });
        } catch (err) {
          callback({
            code: grpc.status.INTERNAL,
            message:
              err instanceof Error ? err.message : "airport search failed",
          });
        }
      },
    });

    const address = `0.0.0.0:${env.grpcPort}`;
    server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        console.log(`🔌 Airport gRPC service listening on ${address}`);
        resolve(port);
      },
    );
  });
}

// Lazily-created gRPC client used by the REST gateway.
let client: any = null;
function getClient() {
  if (!client) {
    client = new AirportService(
      `localhost:${env.grpcPort}`,
      grpc.credentials.createInsecure(),
    );
  }
  return client;
}

/** Call the gRPC AirportService.Search from the REST gateway. */
export function searchAirportsViaGrpc(
  q: string,
  limit = 8,
): Promise<AirportHit[]> {
  return new Promise((resolve, reject) => {
    getClient().Search(
      { q, limit },
      (err: grpc.ServiceError | null, reply: any) => {
        if (err) return reject(err);
        resolve((reply?.airports ?? []) as AirportHit[]);
      },
    );
  });
}
