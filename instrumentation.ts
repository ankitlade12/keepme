import { registerOTel } from "@vercel/otel";
import { assertProductionConfiguration } from "@/lib/server-config";

export function register() {
  assertProductionConfiguration();
  registerOTel({ serviceName: "keepme-web" });
}
