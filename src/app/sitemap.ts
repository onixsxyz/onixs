import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";
import { SITEMAP_ROUTES } from "@/components/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return SITEMAP_ROUTES.map((path) => ({ url: `${BRAND.url}${path === "/" ? "" : path}`, lastModified: now, changeFrequency: path === "/" ? "daily" : "weekly", priority: path === "/" ? 1 : 0.6 }));
}
