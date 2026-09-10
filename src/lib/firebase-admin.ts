import { cert, getApp, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cached: Firestore | null = null;

export function db(): Firestore {
  if (cached) return cached;

  // A credencial pode vir em uma variável só (FIREBASE_SERVICE_ACCOUNT) ou, quando o
  // painel não aceita um valor tão longo de uma vez, partida em duas:
  // FIREBASE_SERVICE_ACCOUNT_1 + FIREBASE_SERVICE_ACCOUNT_2 (concatenadas nesta ordem).
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    [process.env.FIREBASE_SERVICE_ACCOUNT_1, process.env.FIREBASE_SERVICE_ACCOUNT_2]
      .filter(Boolean)
      .join("");
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT não está configurada nas variáveis de ambiente.");

  let parsed: ServiceAccount & { private_key?: string };
  try {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    const n = raw.trim().length;
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT não é um JSON válido (o valor salvo tem ${n} caracteres; ` +
      `o esperado são 2720). Reveja a variável nas configurações da Vercel.`
    );
  }
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");

  const app = getApps().length ? getApp() : initializeApp({ credential: cert(parsed) });
  cached = getFirestore(app);
  try { cached.settings({ ignoreUndefinedProperties: true }); } catch { /* já configurado */ }
  return cached;
}

export const COL = "devolucoes";
export const APP_DOC = (name: string) => db().collection("app").doc(name);

/**
 * Carimbo da última alteração na base. Existe para a tela poder perguntar "mudou
 * alguma coisa?" com UMA leitura, em vez de reler a coleção inteira a cada 30
 * segundos — que é o que estourava a cota gratuita do Firestore em uma hora de aba
 * aberta.
 */
export async function bumpRev(): Promise<number> {
  const rev = Date.now();
  try { await APP_DOC("estado").set({ rev }, { merge: true }); } catch { /* nao bloqueia a escrita principal */ }
  return rev;
}

export async function lerRev(): Promise<number> {
  const snap = await APP_DOC("estado").get();
  return Number(snap.data()?.rev) || 0;
}
