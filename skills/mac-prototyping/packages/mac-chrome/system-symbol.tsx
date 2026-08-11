export type SystemSymbolName =
  | "arrow.triangle.2.circlepath"
  | "arrow.up"
  | "arrow.up.right"
  | "briefcase.fill"
  | "building.2.fill"
  | "building.columns.fill"
  | "chart.line.uptrend.xyaxis"
  | "chart.pie.fill"
  | "checkmark"
  | "checkmark.seal.fill"
  | "chevron.down"
  | "chevron.left"
  | "chevron.right"
  | "cross.case.fill"
  | "doc.badge.arrow.down"
  | "doc.text.fill"
  | "envelope.badge"
  | "folder"
  | "folder.badge.plus"
  | "key.fill"
  | "list.bullet"
  | "magnifyingglass"
  | "network"
  | "person.2.fill"
  | "person.crop.circle"
  | "shield.fill"
  | "sidebar.left"
  | "sidebar.trailing"
  | "sparkles"
  | "square.grid.2x2"
  | "xmark";

function SymbolPaths({ name }: { readonly name: SystemSymbolName }) {
  switch (name) {
    case "arrow.triangle.2.circlepath":
      return <><path d="M5 8.3A7.2 7.2 0 0 1 17.3 6L19 7.8" /><path d="M19 4.6v3.2h-3.2" /><path d="M19 15.7A7.2 7.2 0 0 1 6.7 18L5 16.2" /><path d="M5 19.4v-3.2h3.2" /></>;
    case "arrow.up":
      return <><path d="M12 19.5V5.5" /><path d="m5.8 11.2 6.2-6.2 6.2 6.2" /></>;
    case "arrow.up.right":
      return <><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>;
    case "briefcase.fill":
      return <><path d="M8.3 6V4.8c0-1 .8-1.8 1.8-1.8h3.8c1 0 1.8.8 1.8 1.8V6" /><rect x="3" y="6" width="18" height="14" rx="2.5" className="symbol-fill" /><path d="M3.7 11.1c5.5 2 11.1 2 16.6 0M10.4 12.7h3.2" className="symbol-knockout" /></>;
    case "building.2.fill":
      return <><path d="M4 21V7l7-4v18Zm7 0V9l9-3v15Z" className="symbol-fill" /><path d="M7 9h1M7 12h1M7 15h1M14 11h3M14 14h3M14 17h3" className="symbol-knockout" /></>;
    case "building.columns.fill":
      return <><path d="m12 2.8 9 5.1v2.2H3V7.9Z" className="symbol-fill" /><path d="M4.2 19.4h15.6M3 21.2h18M6.2 10.1v9.3M10.1 10.1v9.3M13.9 10.1v9.3M17.8 10.1v9.3" /></>;
    case "chart.line.uptrend.xyaxis":
      return <><path d="M4 3.5v16.5h16.5" /><path d="m6.5 16 4.2-4.4 3 2.2 5.2-6" /><path d="M15.8 7.8h3.1v3.1" /></>;
    case "chart.pie.fill":
      return <><path d="M11 3.5a8.5 8.5 0 1 0 8.5 8.5H11Z" className="symbol-fill" /><path d="M13 3.5V10h6.5A8.5 8.5 0 0 0 13 3.5Z" className="symbol-fill" /></>;
    case "checkmark":
      return <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />;
    case "checkmark.seal.fill":
      return <><path d="m12 2.5 2 1.3 2.4-.1.9 2.2 2 1.4-.5 2.4 1.1 2.1-1.6 1.8-.1 2.4-2.3.6-1.3 2-2.3-.7-2.1 1.1-1.8-1.6-2.4-.1-.6-2.3-2-1.3.7-2.3-1.1-2.1 1.6-1.8.1-2.4 2.3-.6 1.3-2 2.3.7Z" className="symbol-fill" /><path d="m8.2 12 2.5 2.5 5.2-5.3" className="symbol-knockout" /></>;
    case "chevron.down":
      return <path d="m5 9 7 7 7-7" />;
    case "chevron.left":
      return <path d="m15 5-7 7 7 7" />;
    case "chevron.right":
      return <path d="m9 5 7 7-7 7" />;
    case "cross.case.fill":
      return <><path d="M8.3 5V3.9c0-.8.7-1.4 1.5-1.4h4.4c.8 0 1.5.6 1.5 1.4V5" /><rect x="3" y="5" width="18" height="16" rx="3" className="symbol-fill" /><path d="M10.4 8.4h3.2v2h2v3.2h-2v2h-3.2v-2h-2v-3.2h2Z" className="symbol-knockout" /></>;
    case "doc.badge.arrow.down":
      return <><path d="M5.5 2.8h7.2l4.8 4.8v13.6h-12Z" /><path d="M12.7 2.8v4.8h4.8M11.5 10.5v6M8.9 14l2.6 2.6 2.6-2.6" /><circle cx="18.5" cy="17.8" r="3" className="symbol-fill" /><path d="M18.5 15.9v3.8M16.6 17.8h3.8" className="symbol-knockout" /></>;
    case "doc.text.fill":
      return <><path d="M6 2.8h7.6L19 8.2v13H6Z" className="symbol-fill" /><path d="M13.6 2.8v5.4H19M8.8 12h7.4M8.8 15h7.4M8.8 18h5" className="symbol-knockout" /></>;
    case "envelope.badge":
      return <><rect x="3" y="5.5" width="18" height="13" rx="2.2" /><path d="m4.2 7 7.8 6 7.8-6" /><circle cx="18.2" cy="5.2" r="2.8" className="symbol-fill" /></>;
    case "folder":
      return <path d="M3 6.2c0-1 .8-1.7 1.7-1.7h5l2 2h7.6c.9 0 1.7.8 1.7 1.7v9.6c0 .9-.8 1.7-1.7 1.7H4.7c-.9 0-1.7-.8-1.7-1.7Z" />;
    case "folder.badge.plus":
      return <><path d="M3 6.2c0-1 .8-1.7 1.7-1.7h5l2 2h7.6c.9 0 1.7.8 1.7 1.7v9.6c0 .9-.8 1.7-1.7 1.7H4.7c-.9 0-1.7-.8-1.7-1.7Z" /><circle cx="18.2" cy="16.8" r="3.2" className="symbol-fill" /><path d="M18.2 15.1v3.4M16.5 16.8h3.4" className="symbol-knockout" /></>;
    case "key.fill":
      return <><circle cx="8" cy="12" r="4.5" /><path d="M12.5 12H21M17.2 12v3M20 12v2" /></>;
    case "list.bullet":
      return <><path d="M8.5 5.5H20M8.5 12H20M8.5 18.5H20" /><circle cx="4.2" cy="5.5" r="1" /><circle cx="4.2" cy="12" r="1" /><circle cx="4.2" cy="18.5" r="1" /></>;
    case "magnifyingglass":
      return <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.2 15.2 4.8 4.8" /></>;
    case "network":
      return <><circle cx="12" cy="5" r="2.4" /><circle cx="5" cy="17.5" r="2.4" /><circle cx="19" cy="17.5" r="2.4" /><path d="m10.8 7.1-4.6 8.2M13.2 7.1l4.6 8.2M7.4 17.5h9.2" /></>;
    case "person.2.fill":
      return <><circle cx="9" cy="8" r="3.1" className="symbol-fill" /><circle cx="16.8" cy="9" r="2.5" className="symbol-fill" /><path d="M3.5 19.5c.5-4 2.4-6.1 5.5-6.1s5 2.1 5.5 6.1Z" className="symbol-fill" /><path d="M14 14.1c.8-.5 1.7-.8 2.8-.8 2.4 0 3.9 1.8 4.2 5.1h-5.2" className="symbol-fill" /></>;
    case "person.crop.circle":
      return <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="9" r="3" /><path d="M6.7 18.3c.9-3 2.7-4.5 5.3-4.5s4.4 1.5 5.3 4.5" /></>;
    case "shield.fill":
      return <><path d="M12 2.5 20 5.7v5.8c0 5-3.2 8.4-8 10-4.8-1.6-8-5-8-10V5.7Z" className="symbol-fill" /><path d="m8.2 12.1 2.4 2.4 5.1-5.2" className="symbol-knockout" /></>;
    case "sidebar.left":
      return <><rect x="2.75" y="4.5" width="18.5" height="15" rx="2.4" /><path d="M9.5 5v14" /><path d="M5.6 8.2h1.6M5.6 11.2h1.6M5.6 14.2h1.6" /></>;
    case "sidebar.trailing":
      return <><rect x="2.75" y="4.5" width="18.5" height="15" rx="2.4" /><path d="M14.5 5v14" /><path d="M16.8 8.2h1.6M16.8 11.2h1.6M16.8 14.2h1.6" /></>;
    case "sparkles":
      return <><path d="M9 3.5c.5 3.1 2.4 5 5.5 5.5-3.1.5-5 2.4-5.5 5.5C8.5 11.4 6.6 9.5 3.5 9 6.6 8.5 8.5 6.6 9 3.5Z" /><path d="M17.2 12.7c.3 2 1.6 3.3 3.6 3.6-2 .3-3.3 1.6-3.6 3.6-.3-2-1.6-3.3-3.6-3.6 2-.3 3.3-1.6 3.6-3.6Z" /></>;
    case "square.grid.2x2":
      return <><rect x="3" y="3" width="7" height="7" rx="1.3" /><rect x="14" y="3" width="7" height="7" rx="1.3" /><rect x="3" y="14" width="7" height="7" rx="1.3" /><rect x="14" y="14" width="7" height="7" rx="1.3" /></>;
    case "xmark":
      return <path d="m6 6 12 12M18 6 6 18" />;
  }
}

export function SystemSymbol({ className, name, size }: {
  readonly className?: string;
  readonly name: SystemSymbolName;
  readonly size?: number;
}) {
  return (
    <svg className={className} data-system-symbol={name} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <SymbolPaths name={name} />
    </svg>
  );
}
