import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { RESTAURANT } from "@/lib/data";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const waLink = (text?: string) =>
  `https://wa.me/${RESTAURANT.wa}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const rs = (n: number) => "Rs." + n.toLocaleString();
