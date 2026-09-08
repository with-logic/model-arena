export const dynamic = "force-static";
import { loadApps } from "@/lib/code-examples";
import { Arena } from "@/components/arena";

export default async function Home() {
  return <Arena apps={await loadApps()} />;
}
