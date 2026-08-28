import RadarApp from "@/components/RadarApp";
import { COL, APP_DOC, db } from "@/lib/firebase-admin";
import { DEFAULT_CONFIG, type Config, type Devolucao, type Mappings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  let rows: Devolucao[] = [];
  let cfg: Config = DEFAULT_CONFIG;
  let maps: Mappings = {};
  let erro: string | null = null;

  try {
    const firestore = db();
    const [snap, cfgSnap, mapSnap] = await Promise.all([
      firestore.collection(COL).limit(5000).get(),
      APP_DOC("config").get(),
      APP_DOC("mappings").get(),
    ]);
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Devolucao[];
    cfg = { ...DEFAULT_CONFIG, ...((cfgSnap.data()?.canais as Config) || {}) };
    maps = (mapSnap.data()?.maps as Mappings) || {};
  } catch (e) {
    erro = (e as Error).message;
  }

  return <RadarApp initialRows={rows} initialCfg={cfg} initialMaps={maps} erroInicial={erro} />;
}
