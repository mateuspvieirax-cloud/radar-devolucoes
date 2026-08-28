import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "rvx_radar";

/**
 * A porta de entrada do app.
 *
 * Se a variável APP_KEY NÃO estiver configurada, o app é aberto: o endereço da
 * Vercel funciona direto, sem chave e sem senha. É assim que ele está hoje.
 *
 * Se um dia você quiser fechar o acesso, basta criar a variável APP_KEY na Vercel
 * (uma string longa e aleatória) e fazer um novo deploy. A partir daí o app só
 * abre para quem entrar uma vez por  /?k=SUA_CHAVE  — nada mais precisa mudar
 * no código.
 */

function matches(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const expected = (process.env.APP_KEY || "").trim();

  // Sem APP_KEY configurada: acesso aberto.
  if (expected.length < 8) return NextResponse.next();

  const url = req.nextUrl;

  // 1) Link com a chave: /?k=CHAVE — grava o cookie e limpa a URL.
  const k = url.searchParams.get("k");
  if (k && matches(k, expected)) {
    const clean = url.clone();
    clean.searchParams.delete("k");
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, k, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // 180 dias
    });
    return res;
  }

  // 2) Já tem o cookie válido.
  if (matches(req.cookies.get(COOKIE)?.value, expected)) return NextResponse.next();

  // 3) Nada feito: não revela que a aplicação existe.
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }
  return new NextResponse(
    "<!doctype html><meta charset='utf-8'><title>404</title>" +
      "<body style='font:15px system-ui;padding:3rem;color:#444'>Página não encontrada.</body>",
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
