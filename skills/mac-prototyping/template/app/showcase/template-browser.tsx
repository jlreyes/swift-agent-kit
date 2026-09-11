"use client";

import { useRef, useState } from "react";
import { MacButton, MacList, MacSearchField, MacSheet, SystemSymbol } from "../../lib/mac-chrome/index.ts";
import "./template-browser.css";

const templates = [
  { id: "project-brief", label: "Project Brief", description: "Goals, scope, and milestones for a new project." },
  { id: "meeting-notes", label: "Meeting Notes", description: "An agenda, decisions, and next steps." },
  { id: "weekly-plan", label: "Weekly Plan", description: "Priorities and tasks for the week ahead." },
  { id: "research", label: "Research Summary", description: "Questions, findings, and references." },
  { id: "design-review", label: "Design Review", description: "A proposal with feedback and open questions." },
  { id: "release-notes", label: "Release Notes", description: "Changes and improvements in a release." },
  { id: "checklist", label: "Checklist", description: "A reusable list of steps to complete." },
  { id: "decision", label: "Decision Record", description: "Context, options, and a recorded decision." },
  { id: "retrospective", label: "Retrospective", description: "What worked and what to improve next time." },
  { id: "reading", label: "Reading Notes", description: "Key ideas and notes from your reading." },
] as const;

export function TemplateBrowser({ onChoose }: { readonly onChoose: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const matchingTemplates = templates.filter((template) => `${template.label} ${template.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedTemplate = matchingTemplates.find((template) => template.id === selectedId);

  return (
    <>
      <MacButton ref={triggerRef} onPress={() => setOpen(true)}>Browse Templates…</MacButton>
      <MacSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Browse Templates"
        size="wide"
        contentInset="none"
        bodyScroll="contained"
        fallbackFocusRef={triggerRef}
        initialFocusSelector=".mc-search-input"
        headerAccessory={<MacSearchField ariaLabel="Search templates" placeholder="Search templates" value={query} onChange={setQuery} />}
        actions={[
          { id: "blank", label: "Start Blank", placement: "leading", onPress: () => onChoose("Untitled Project") },
          { id: "cancel", label: "Cancel", role: "cancel", placement: "trailing" },
          { id: "choose", label: "Choose", isDefault: true, placement: "trailing", disabled: selectedTemplate === undefined, onPress: () => { if (selectedTemplate !== undefined) onChoose(selectedTemplate.label); } },
        ]}
      >
        <MacList
          ariaLabel="Templates"
          className="showcase-template-list"
          escapeKeyBehavior="none"
          emptyState="No matching templates"
          selectedId={selectedTemplate?.id ?? null}
          onSelectionChange={setSelectedId}
          sections={[{ id: "templates", items: matchingTemplates.map((template) => ({ ...template, icon: <SystemSymbol name="doc.text" /> })) }]}
        />
      </MacSheet>
    </>
  );
}
