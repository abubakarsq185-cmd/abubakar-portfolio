import type { MetadataRoute } from "next";
import { RESTAURANT } from "@/lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: RESTAURANT.url,
      lastModified: new Date("2026-07-21"),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
