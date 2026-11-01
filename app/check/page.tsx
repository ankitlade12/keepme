import { clerkConfigured } from "@/lib/clerk-config";
import { ShoppingWorkspace } from "@/components/ShoppingWorkspace";
import { liveTryOnStatus } from "@/lib/runtime-capabilities";
export const dynamic = "force-dynamic";
export default function CheckPage() {
  return (
    <ShoppingWorkspace
      liveAvailable={liveTryOnStatus().available}
      accountAvailable={clerkConfigured()}
    />
  );
}
