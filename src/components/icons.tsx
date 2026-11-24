/** Line icons for the navigation; 24×24, drawn with the current text colour. */

const PATHS = {
  week: "M4 6h16v14H4zM4 11h16M8 3v4M16 3v4",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  dishes: "M3 8h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM6 12h12M14 8c1-3 4-4 6-3",
  ingredients: "M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7",
  review: "M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9",
  settings: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
