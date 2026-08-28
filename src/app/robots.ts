import type { MetadataRoute } from "next";

// O app não deve aparecer em busca nenhuma.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
