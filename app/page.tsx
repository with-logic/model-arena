export const dynamic = "force-static";
import { loadApps } from "@/lib/code-examples";
import { AppGridWithRouting } from "@/components/app-grid-with-routing";

export default async function Home() {
  return <AppGridWithRouting apps={await loadApps()} />;
}
