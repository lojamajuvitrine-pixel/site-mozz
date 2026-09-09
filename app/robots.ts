import type { MetadataRoute } from "next";
import { SITE_URL as siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/google-feed", "/api/meta-feed"],
      disallow: ["/api/", "/carrinho", "/checkout/"]
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
