import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const WA = '923189659090'
export const waLink = (text) =>
  `https://wa.me/${WA}${text ? `?text=${encodeURIComponent(text)}` : ''}`
export const rs = (n) => 'Rs.' + n.toLocaleString()
