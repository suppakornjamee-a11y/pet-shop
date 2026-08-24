import type { Species } from "@/generated/prisma/enums";

export function SpeciesIcon({ species, className }: { species: Species; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/icons/${species === "CAT" ? "cat" : "dog"}.png`}
      alt=""
      className={className}
    />
  );
}
