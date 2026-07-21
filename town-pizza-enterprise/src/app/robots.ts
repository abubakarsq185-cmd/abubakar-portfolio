import type { MetadataRoute } from "next";
import { RESTAURANT } from "@/lib/data";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${RESTAURANT.url}/sitemap.xml`,
  };
}
