"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SectionHead } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { branches } from "@/lib/data";
import { waLink } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Please enter your name"),
  phone: z.string().min(7, "Enter a valid phone number").regex(/^[0-9+\-\s]+$/, "Digits only"),
  branch: z.string().min(1, "Choose a branch"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a time"),
  guests: z.number({ message: "Enter number of guests" }).min(1, "At least 1 guest").max(60, "Call us for 60+"),
  notes: z.string().max(300).optional(),
});
type FormValues = z.infer<typeof schema>;

const field = "w-full rounded-xl border border-gold/25 bg-white/[0.04] px-4 py-3 font-[family-name:var(--font-body)] text-cream outline-none transition-colors placeholder:text-cream/40 focus:border-gold";
const label = "mb-1.5 block font-[family-name:var(--font-oswald)] text-[12px] uppercase tracking-wide text-gold-light";

export function Reservation() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { guests: 2 } });

  const onSubmit = (v: FormValues) => {
    const text = `Hi Town Pizza Hut! I'd like to book a table:\n• Name: ${v.name}\n• Phone: ${v.phone}\n• Branch: ${v.branch}\n• Date: ${v.date} at ${v.time}\n• Guests: ${v.guests}${v.notes ? `\n• Notes: ${v.notes}` : ""}`;
    window.open(waLink(text), "_blank", "noopener,noreferrer");
    setDone(true);
  };

  return (
    <section id="reserve" className="px-[6vw] py-24" style={{ background: "linear-gradient(180deg,#140809,#22120f)" }}>
      <SectionHead eyebrow="Book a table" title="Reserve" em="Your Seat" />
      <div className="mx-auto max-w-[720px] rounded-[24px] border border-gold/20 bg-white/[0.02] p-8 sm:p-10">
        {done ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-gold" size={56} />
            <h3 className="font-[family-name:var(--font-playfair)] text-2xl text-cream">Almost there!</h3>
            <p className="mx-auto mt-2 max-w-[420px] text-[#cbb79c]">We&apos;ve opened WhatsApp with your reservation details — just hit send and our team will confirm your table shortly.</p>
            <button onClick={() => setDone(false)} className="mt-6 font-[family-name:var(--font-oswald)] text-sm uppercase tracking-wide text-gold underline underline-offset-4">
              Make another booking
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="r-name">Full name</label>
              <input id="r-name" className={field} placeholder="Your name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <p className="mt-1 text-xs text-red-bright">{errors.name.message}</p>}
            </div>
            <div>
              <label className={label} htmlFor="r-phone">Phone</label>
              <input id="r-phone" className={field} placeholder="03xx xxxxxxx" inputMode="tel" {...register("phone")} aria-invalid={!!errors.phone} />
              {errors.phone && <p className="mt-1 text-xs text-red-bright">{errors.phone.message}</p>}
            </div>
            <div>
              <label className={label} htmlFor="r-branch">Branch</label>
              <select id="r-branch" className={field} defaultValue="" {...register("branch")} aria-invalid={!!errors.branch}>
                <option value="" disabled>Select a branch</option>
                {branches.map((b) => (
                  <option key={b.n} value={`${b.n} — ${b.addr}`} className="bg-maroon-deep">{b.n} — {b.addr.split(",")[0]}</option>
                ))}
              </select>
              {errors.branch && <p className="mt-1 text-xs text-red-bright">{errors.branch.message}</p>}
            </div>
            <div>
              <label className={label} htmlFor="r-guests">Guests</label>
              <input id="r-guests" type="number" min={1} max={60} className={field} {...register("guests", { valueAsNumber: true })} aria-invalid={!!errors.guests} />
              {errors.guests && <p className="mt-1 text-xs text-red-bright">{errors.guests.message}</p>}
            </div>
            <div>
              <label className={label} htmlFor="r-date">Date</label>
              <input id="r-date" type="date" className={field} {...register("date")} aria-invalid={!!errors.date} />
              {errors.date && <p className="mt-1 text-xs text-red-bright">{errors.date.message}</p>}
            </div>
            <div>
              <label className={label} htmlFor="r-time">Time</label>
              <input id="r-time" type="time" className={field} {...register("time")} aria-invalid={!!errors.time} />
              {errors.time && <p className="mt-1 text-xs text-red-bright">{errors.time.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="r-notes">Notes (optional)</label>
              <textarea id="r-notes" rows={3} className={field} placeholder="Birthday, high chair, allergies…" {...register("notes")} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Confirm on WhatsApp"}
              </Button>
              <p className="mt-3 text-center text-xs text-cream/50">We confirm every booking personally on WhatsApp within minutes.</p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
