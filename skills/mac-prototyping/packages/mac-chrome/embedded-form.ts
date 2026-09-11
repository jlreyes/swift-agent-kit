"use client";

import type { KeyboardEvent, MouseEvent } from "react";

import { useEmbeddedPresentation } from "./embedded-presentation.tsx";

type SubmitControl = HTMLButtonElement | HTMLInputElement;

const implicitSubmissionTypes = new Set(["text", "search", "tel", "url", "email", "password", "date", "month", "week", "time", "datetime-local", "number"]);

function isSubmitControl(element: Element | null): element is SubmitControl {
  return (element instanceof HTMLButtonElement && element.type === "submit")
    || (element instanceof HTMLInputElement && (element.type === "submit" || element.type === "image"));
}

export function useEmbeddedForm() {
  const embedded = useEmbeddedPresentation() !== null;

  function requestSubmit(form: HTMLFormElement, submitter?: SubmitControl) {
    if (!embedded) {
      form.requestSubmit(submitter);
      return;
    }
    if (submitter !== undefined && (submitter.form !== form || submitter.matches(":disabled"))) return;
    if (!form.noValidate && !submitter?.formNoValidate && !form.reportValidity()) return;
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: submitter ?? null }));
  }

  function submitAfterActivation(form: HTMLFormElement, submitter: SubmitControl) {
    // Let the activating press commit before locally reproducing native validated submission.
    queueMicrotask(() => {
      if (form.isConnected && submitter.isConnected) requestSubmit(form, submitter);
    });
  }

  function onFormClick(event: MouseEvent<HTMLFormElement>) {
    const target = event.target instanceof Element ? event.target.closest("button,input") : null;
    if (!event.defaultPrevented && event.button === 0 && isSubmitControl(target) && target.form === event.currentTarget && !target.matches(":disabled")) {
      event.preventDefault();
      submitAfterActivation(event.currentTarget, target);
    }
  }

  function onSubmitButtonClickCapture(event: MouseEvent<Element>) {
    const button = event.currentTarget;
    if (isSubmitControl(button) && button.form !== null) event.preventDefault();
  }

  function onSubmitButtonPress(target: Element) {
    if (isSubmitControl(target) && target.form !== null && !target.matches(":disabled")) submitAfterActivation(target.form, target);
  }

  function onFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (!embedded || event.defaultPrevented || event.key !== "Enter" || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    const form = event.currentTarget;
    if (!(target instanceof HTMLInputElement) || target.form !== form || !implicitSubmissionTypes.has(target.type)) return;
    const controls = Array.from(form.elements);
    const submitter = controls.find((element) => isSubmitControl(element));
    event.preventDefault();
    if (submitter !== undefined && isSubmitControl(submitter)) {
      if (!submitter.matches(":disabled")) submitter.click();
      return;
    }
    if (controls.filter((element) => element instanceof HTMLInputElement && implicitSubmissionTypes.has(element.type)).length <= 1) requestSubmit(form);
  }

  return {
    onFormClick: embedded ? onFormClick : undefined,
    onFormKeyDown: embedded ? onFormKeyDown : undefined,
    onSubmitButtonClickCapture: embedded ? onSubmitButtonClickCapture : undefined,
    onSubmitButtonPress: embedded ? onSubmitButtonPress : undefined,
    requestSubmit,
  };
}
