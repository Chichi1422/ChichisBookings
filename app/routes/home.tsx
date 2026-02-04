import type { Route } from "./+types/home";
import { ChiChisSpa } from "~/components/spa";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chi Chi's Beauty Spa | Premium Wellness Experience" },
    { name: "description", content: "Indulge in luxury spa treatments designed to restore your body, rejuvenate your spirit, and awaken your inner radiance. Book your appointment today." },
    { name: "theme-color", content: "#0a0a0a" },
  ];
}

export default function Home() {
  return <ChiChisSpa />;
}