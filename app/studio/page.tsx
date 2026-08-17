import { SiteHeader } from "@/components/SiteHeader";
import { StudioApp } from "@/components/StudioApp";
import { liveTryOnStatus } from "@/lib/runtime-capabilities";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  const liveModeAvailable = liveTryOnStatus().available;
  return <div className="studio-page"><SiteHeader studio /><StudioApp liveModeAvailable={liveModeAvailable} /></div>;
}
