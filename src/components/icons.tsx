/** Line icons for the navigation; 24×24, drawn with the current text colour. */

const PATHS = {
  week: "M4 6h16M4 6v13h16V6M8 3v4M16 3v4M4 11h16",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  dishes: "M4 13h16a8 8 0 0 1-16 0ZM12 5v3M8 6l1 2.5M16 6l-1 2.5",
  review: "M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h4l1 2h6l1-2h4",
  settings: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
