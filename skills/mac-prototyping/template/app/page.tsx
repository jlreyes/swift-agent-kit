const surfaces = [
  {
    href: "/showcase",
    title: "Component showcase",
    description: "Interactive stories for every mac-chrome window, toolbar, menu, and system surface.",
  },
  {
    href: "/example",
    title: "Example",
    description: "DesktopShell + one window + dock — the page-wrapper starter.",
  },
];

export default function Home() {
  return (
    <main className="launcher">
      <h1>Mac prototype surfaces</h1>
      <p>Each surface is a page under <code>app/</code>. Add yours to this list.</p>
      <ul>
        {surfaces.map((surface) => (
          <li key={surface.href}>
            <a href={surface.href}>
              <strong>{surface.title}</strong>
              <span>{surface.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
