"use client";

import type { FormEventHandler, ReactNode, Ref } from "react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Switch,
  Text,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  type Key,
  type Selection,
} from "react-aria-components";

import "./styles/tokens.css";
import "./styles/controls.css";

export type MacButtonVariant = "regular" | "primary" | "destructive" | "borderless";

export function MacButton({
  ariaLabel,
  children,
  className = "",
  disabled = false,
  ref,
  type = "button",
  variant = "regular",
  onPress,
}: {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
  readonly type?: "button" | "submit" | "reset";
  readonly variant?: MacButtonVariant;
  readonly onPress?: () => void;
}) {
  return (
    <Button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      className={`mc-button mc-button-${variant} ${className}`.trim()}
      isDisabled={disabled}
      onPress={onPress}
    >
      {children}
    </Button>
  );
}

export function MacTextField({
  ariaLabel,
  autoComplete,
  className = "",
  description,
  disabled = false,
  errorMessage,
  invalid = false,
  label,
  name,
  placeholder,
  readOnly = false,
  type = "text",
  value,
  onChange,
}: {
  /** Required when no visible label is supplied. */
  readonly ariaLabel?: string;
  readonly autoComplete?: string;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly errorMessage?: ReactNode;
  readonly invalid?: boolean;
  readonly label?: ReactNode;
  readonly name?: string;
  readonly placeholder?: string;
  readonly readOnly?: boolean;
  readonly type?: "email" | "password" | "search" | "text" | "url";
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <TextField
      aria-label={label === undefined ? ariaLabel : undefined}
      className={`mc-text-field ${className}`.trim()}
      isDisabled={disabled}
      isInvalid={invalid}
      isReadOnly={readOnly}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
    >
      {label !== undefined ? <Label className="mc-field-label">{label}</Label> : null}
      <Input className="mc-field-input" autoComplete={autoComplete} placeholder={placeholder} />
      {description !== undefined ? <Text className="mc-field-description" slot="description">{description}</Text> : null}
      {errorMessage !== undefined ? <Text className="mc-field-error" slot="errorMessage">{errorMessage}</Text> : null}
    </TextField>
  );
}

export type MacToggleStyle = "checkbox" | "switch";

export function MacToggle({
  children,
  className = "",
  disabled = false,
  selected,
  style = "checkbox",
  onChange,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly selected: boolean;
  readonly style?: MacToggleStyle;
  readonly onChange: (selected: boolean) => void;
}) {
  if (style === "switch") {
    return (
      <Switch
        className={`mc-toggle mc-toggle-switch ${className}`.trim()}
        isDisabled={disabled}
        isSelected={selected}
        onChange={onChange}
      >
        <span className="mc-switch-track" aria-hidden="true"><span className="mc-switch-thumb" /></span>
        <span className="mc-toggle-label">{children}</span>
      </Switch>
    );
  }

  return (
    <Checkbox
      className={`mc-toggle mc-toggle-checkbox ${className}`.trim()}
      isDisabled={disabled}
      isSelected={selected}
      onChange={onChange}
    >
      <span className="mc-checkbox-box" aria-hidden="true"><span className="mc-checkbox-check" /></span>
      <span className="mc-toggle-label">{children}</span>
    </Checkbox>
  );
}

export type MacSegment = {
  readonly id: string;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

export function MacSegmentedControl({
  ariaLabel,
  className = "",
  disabled = false,
  options,
  value,
  onChange,
}: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly options: readonly MacSegment[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  function handleSelectionChange(selection: Selection) {
    if (selection === "all") return;
    const next = [...selection][0];
    if (typeof next === "string" && next !== value) onChange(next);
  }

  return (
    <ToggleButtonGroup
      aria-label={ariaLabel}
      className={`mc-segmented-control ${className}`.trim()}
      isDisabled={disabled}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set<Key>([value])}
      onSelectionChange={handleSelectionChange}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className="mc-segmented-option"
          isDisabled={option.disabled}
        >
          {option.icon !== undefined ? <span className="mc-segmented-icon" aria-hidden="true">{option.icon}</span> : null}
          <span>{option.label}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export function MacControlGroup({
  ariaLabel,
  children,
  className = "",
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={`mc-control-group ${className}`.trim()} role="group" aria-label={ariaLabel}>{children}</div>;
}

export function MacForm({
  ariaLabel,
  children,
  className = "",
  onSubmit,
}: {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  return <form className={`mc-form ${className}`.trim()} aria-label={ariaLabel} onSubmit={onSubmit}>{children}</form>;
}

export function MacFormSection({
  children,
  className = "",
  description,
  disabled = false,
  title,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly title?: ReactNode;
}) {
  return (
    <fieldset className={`mc-form-section ${className}`.trim()} disabled={disabled}>
      {title !== undefined ? <legend>{title}</legend> : null}
      {description !== undefined ? <p className="mc-form-section-description">{description}</p> : null}
      <div className="mc-form-section-content">{children}</div>
    </fieldset>
  );
}

export function MacLabeledContent({
  children,
  className = "",
  description,
  label,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly label: ReactNode;
}) {
  return (
    <div className={`mc-labeled-content ${className}`.trim()}>
      <div className="mc-labeled-content-label">
        <span>{label}</span>
        {description !== undefined ? <small>{description}</small> : null}
      </div>
      <div className="mc-labeled-content-value">{children}</div>
    </div>
  );
}
