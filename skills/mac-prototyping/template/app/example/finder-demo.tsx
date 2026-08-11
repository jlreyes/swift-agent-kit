"use client";

// Client-side fixture for the example's Finder window. FinderWindow's API
// takes callback props (onModeChange, selection.onSelect, ...), which a
// server page cannot pass across the RSC boundary — so the fixture owns its
// state here and the server page just composes <FinderDemo />.
import { useState } from "react";

import { SFSymbol } from "../../components/SFSymbol.tsx";
import { FinderWindow, type FinderEntry, type FinderViewMode, type SidebarSection } from "../../lib/mac-chrome/index.ts";

const entries: readonly FinderEntry[] = [
  { id: "roadmap", name: "Roadmap.md", kind: "document", icon: <SFSymbol name="doc.text" />, modified: "Today, 9:41 AM", size: "12 KB" },
  { id: "research", name: "Research", kind: "folder", icon: <SFSymbol name="folder" />, modified: "Yesterday", size: "—" },
  { id: "wallpaper", name: "Wallpaper.png", kind: "image", icon: <SFSymbol name="photo" />, modified: "Monday", size: "2.1 MB" },
  { id: "demo", name: "Demo.mov", kind: "movie", icon: <SFSymbol name="film" />, modified: "Monday", size: "48 MB" },
  { id: "jingle", name: "Jingle.aiff", kind: "audio", icon: <SFSymbol name="music.note" />, modified: "Jul 30", size: "820 KB" },
  { id: "archive", name: "Archive.zip", kind: "archive", icon: <SFSymbol name="archivebox" />, modified: "Jul 12", size: "9 MB" },
];

export function FinderDemo() {
  const [mode, setMode] = useState<FinderViewMode>("icons");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const sidebar: readonly SidebarSection[] = [
    {
      id: "favorites",
      title: "Favorites",
      items: [
        { id: "recents", icon: <SFSymbol name="clock" />, label: "Recents", onSelect: () => undefined },
        { id: "documents", icon: <SFSymbol name="doc.text" />, label: "Documents", selected: true, badge: 6, onSelect: () => undefined },
      ],
    },
    {
      id: "locations",
      title: "Locations",
      items: [{ id: "macintosh-hd", icon: <SFSymbol name="internaldrive" />, label: "Macintosh HD", onSelect: () => undefined }],
    },
  ];
  const shown = entries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <FinderWindow
      title="Documents"
      sidebarHeader={<div><strong>Example Drive</strong></div>}
      sidebar={sidebar}
      entries={shown}
      mode={mode}
      onModeChange={setMode}
      search={{ value: query, onChange: setQuery }}
      selection={{ selectedId, onSelect: setSelectedId }}
      onOpen={() => undefined}
    />
  );
}
