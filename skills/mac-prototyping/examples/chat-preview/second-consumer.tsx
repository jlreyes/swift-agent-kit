import { useState } from "react";
import {
  MacButton,
  MacToggle,
  MacEmbeddedPresentation,
  MacForm,
  MacPopover,
  MacTextField,
  MacToolbar,
  TrafficLights,
  WindowChrome,
} from "../../packages/mac-chrome/index.ts";
import "../../packages/mac-chrome/styles/embedded.css";
import "./second-consumer.css";

export default function DocumentSettings() {
  const [title, setTitle] = useState("Weekly notes");
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [reminders, setReminders] = useState(false);

  return (
    <MacEmbeddedPresentation height={360}>
      <WindowChrome label="Document settings">
        <MacToolbar
          leading={<TrafficLights />}
          title="Document settings"
          trailing={
            <MacPopover label="Reminder options" trigger="Options">
              <MacToggle selected={reminders} onChange={setReminders}>Enable reminders</MacToggle>
            </MacPopover>
          }
        />
        <main className="second-consumer-content">
          <MacForm
            ariaLabel="Document preferences"
            onSubmit={(event) => {
              event.preventDefault();
              setSavedTitle(title);
            }}
          >
            <MacTextField label="Document title" name="title" value={title} onChange={setTitle} />
            <div className="second-consumer-actions">
              <MacButton type="submit" variant="primary">Save</MacButton>
              <span className="second-consumer-indicator" aria-hidden="true" />
            </div>
          </MacForm>
          <p role="status">{savedTitle === null ? "No changes saved." : `Saved ${savedTitle}.`}</p>
          <p>{reminders ? "Reminders enabled." : "Reminders disabled."}</p>
        </main>
      </WindowChrome>
    </MacEmbeddedPresentation>
  );
}
