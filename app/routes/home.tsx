import type { Route } from "./+types/home";
import { ChiChisSpa } from "~/components/spa";
import { getServiceCatalog, getPricingConfig } from "~/lib/services.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chi Chi's Beauty Spa | Premium Wellness Experience" },
    { name: "description", content: "Indulge in luxury spa treatments designed to restore your body, rejuvenate your spirit, and awaken your inner radiance. Book your appointment today." },
    { name: "theme-color", content: "#0a0a0a" },
  ];
}

export async function loader() {
  const [catalog, config] = await Promise.all([
    getServiceCatalog(),
    getPricingConfig(),
  ]);

  // Map the DB catalog into the client's Service shape (price in ZAR).
  const services = catalog.map((g) => ({
    name: g.name,
    description: g.description,
    icon: g.icon,
    options: g.options.map((o) => ({ duration: o.duration, price: o.priceZar })),
  }));

  return { services, homeCallFee: config.homeCallFeeZar };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <ChiChisSpa services={loaderData.services} homeCallFee={loaderData.homeCallFee} />
  );
}
