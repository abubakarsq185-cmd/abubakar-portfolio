import { VideoHero } from "@/components/sections/VideoHero";
import { Featured } from "@/components/sections/Featured";
import { MenuSection } from "@/components/sections/MenuSection";
import { Customizer } from "@/components/sections/Customizer";
import { Deals } from "@/components/sections/Deals";
import { Ingredients } from "@/components/sections/Ingredients";
import { ChefStory } from "@/components/sections/ChefStory";
import { Gallery } from "@/components/sections/Gallery";
import { Testimonials } from "@/components/sections/Testimonials";
import { Rewards } from "@/components/sections/Rewards";
import { Locations } from "@/components/sections/Locations";
import { Reservation } from "@/components/sections/Reservation";
import { FAQ } from "@/components/sections/FAQ";

export default function Home() {
  return (
    <>
      <VideoHero />
      <Featured />
      <MenuSection />
      <Customizer />
      <Deals />
      <Ingredients />
      <ChefStory />
      <Gallery />
      <Testimonials />
      <Rewards />
      <Locations />
      <Reservation />
      <FAQ />
    </>
  );
}
