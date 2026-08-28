import { cookies } from "next/headers";

export const COOKIE = "rvx_radar";

export function appKey(): string {
  const k = process.env.APP_KEY;
  if (!k || k.length < 8) throw new Error("APP_KEY não configurada (mínimo 8 caracteres).");
  return k;
}

/** Comparação em tempo constante, para não vazar a chave por tempo de resposta. */
export function keyMatches(given: string | undefined | null): boolean {
  if (!given) return false;
  let expected: string;
  try { expected = appKey(); } catch { return false; }
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function autorizado(): Promise<boolean> {
  const store = await cookies();
  return keyMatches(store.get(COOKIE)?.value);
}
