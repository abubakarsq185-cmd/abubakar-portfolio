import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/utils";

export function FloatingWA() {
  return (
    <a
      href={waLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Order on WhatsApp"
      className="fixed bottom-6 right-6 z-[800] flex h-[58px] w-[58px] animate-[wa-pulse_2.5s_infinite] items-center justify-center rounded-full bg-[#25D366] shadow-[0_8px_26px_rgba(37,211,102,.5)] transition-transform hover:scale-110"
    >
      <MessageCircle size={30} className="text-white" />
    </a>
  );
}
