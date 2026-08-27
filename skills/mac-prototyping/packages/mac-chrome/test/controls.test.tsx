// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";

import {
  MacButton,
  MacControlGroup,
  MacForm,
  MacFormSection,
  MacLabeledContent,
  MacSegmentedControl,
  MacTextField,
  MacToggle,
} from "../controls.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("renders the reusable form and button anatomy", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const saveButtonRef = createRef<HTMLButtonElement>();
  let submitted = false;
  await act(async () => {
    root.render(
      <MacForm ariaLabel="Account" onSubmit={(event) => { event.preventDefault(); submitted = true; }}>
        <MacFormSection title="Profile" description="Shown to collaborators.">
          <MacLabeledContent label="Name" description="Required">
            <MacTextField ariaLabel="Name" value="Ada" onChange={() => {}} />
          </MacLabeledContent>
        </MacFormSection>
        <MacControlGroup ariaLabel="Form actions">
          <MacButton ref={saveButtonRef} type="submit" variant="primary">Save</MacButton>
          <MacButton variant="borderless" disabled>Reset</MacButton>
        </MacControlGroup>
      </MacForm>,
    );
  });

  expect(container.querySelector("legend")?.textContent).toBe("Profile");
  expect(container.querySelector("input")?.value).toBe("Ada");
  expect(container.querySelector(".mc-button-primary")?.textContent).toBe("Save");
  expect(saveButtonRef.current).toBe(container.querySelector(".mc-button-primary"));
  await act(async () => saveButtonRef.current?.focus());
  expect(document.activeElement).toBe(saveButtonRef.current);
  expect(container.querySelector<HTMLButtonElement>(".mc-button-borderless")?.disabled).toBe(true);
  await act(async () => container.querySelector<HTMLButtonElement>("button[type='submit']")?.click());
  expect(submitted).toBe(true);

  await act(async () => root.unmount());
  container.remove();
});

it("keeps text, toggle, and segmented values controlled", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let fieldValue = "Before";
  let checkboxValue = false;
  let switchValue = true;
  let segmentValue = "grid";
  await act(async () => {
    root.render(
      <>
        <MacTextField label="Title" value={fieldValue} onChange={(value) => { fieldValue = value; }} />
        <MacToggle selected={checkboxValue} onChange={(value) => { checkboxValue = value; }}>Pinned</MacToggle>
        <MacToggle style="switch" selected={switchValue} onChange={(value) => { switchValue = value; }}>Shared</MacToggle>
        <MacSegmentedControl
          ariaLabel="View"
          value={segmentValue}
          options={[{ id: "grid", label: "Grid" }, { id: "list", label: "List" }]}
          onChange={(value) => { segmentValue = value; }}
        />
      </>,
    );
  });

  const textInput = container.querySelector<HTMLInputElement>("input[type='text']");
  await act(async () => fireEvent.change(textInput as HTMLInputElement, { target: { value: "After" } }));
  expect(fieldValue).toBe("After");

  const toggles = container.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
  await act(async () => toggles[0]?.click());
  await act(async () => toggles[1]?.click());
  expect(checkboxValue).toBe(true);
  expect(switchValue).toBe(false);

  const segments = container.querySelectorAll<HTMLButtonElement>(".mc-segmented-option");
  const listSegment = segments[1];
  expect(segments[0]?.hasAttribute("data-selected")).toBe(true);
  await act(async () => listSegment?.click());
  expect(segmentValue).toBe("list");

  await act(async () => root.unmount());
  container.remove();
});

it("exposes an error only while the controlled text field is invalid", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const errorMessage = "Enter a title before continuing.";

  await act(async () => {
    root.render(
      <MacTextField
        label="Title"
        value=""
        invalid
        errorMessage={errorMessage}
        onChange={() => {}}
      />,
    );
  });

  const input = container.querySelector<HTMLInputElement>("input");
  const error = container.querySelector<HTMLElement>(".mc-field-error");
  expect(input?.getAttribute("aria-invalid")).toBe("true");
  expect(error?.textContent).toBe(errorMessage);
  expect(input?.getAttribute("aria-describedby")?.split(" ")).toContain(error?.id);

  await act(async () => {
    root.render(
      <MacTextField
        label="Title"
        value=""
        invalid={false}
        errorMessage={errorMessage}
        onChange={() => {}}
      />,
    );
  });

  expect(container.querySelector(".mc-field-error")).toBeNull();
  expect(input?.getAttribute("aria-invalid")).toBeNull();
  expect(input?.getAttribute("aria-describedby")).toBeNull();

  await act(async () => root.unmount());
  container.remove();
});
