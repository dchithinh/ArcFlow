import type { ReactNode } from "react";
import { Button, Field, TextArea, TextInput, Toggle, Select } from "./FormControls";

const InputLabel = ({ children }: { children: string }) => (
  <span className="block text-[9px] font-medium uppercase tracking-[0.06em] text-slate/70">
    {children}
  </span>
);

const LabeledInput = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <InputLabel>{label}</InputLabel>
    {children}
  </div>
);

type StringListEditorProps = {
  label: ReactNode;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  getItemLabel?: (index: number) => string;
  getItemPlaceholder?: (index: number) => string;
};

export const StringListEditor = ({
  label,
  hint,
  items,
  onChange,
  placeholder,
  getItemLabel,
  getItemPlaceholder,
}: StringListEditorProps) => {
  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeItem = (index: number) => onChange(items.filter((_, currentIndex) => currentIndex !== index));

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-slate">No entries yet.</p> : null}
        {items.map((item, index) => (
          <div key={`string-list-item-${index}`} className="flex items-start gap-2">
            <div className="flex-1 space-y-1.5">
              <InputLabel>{getItemLabel ? getItemLabel(index) : `Item ${index + 1}`}</InputLabel>
              <TextArea
                value={item}
                onChange={(value) => updateItem(index, value)}
                placeholder={getItemPlaceholder ? getItemPlaceholder(index) : placeholder}
                rows={1}
              />
            </div>
            <Button
              onClick={() => removeItem(index)}
              tone="danger"
              size="compact"
              className="mt-[18px]"
            >
              Remove
            </Button>
          </div>
        ))}
        <Button onClick={() => onChange([...items, ""])}>Add Item</Button>
      </div>
    </Field>
  );
};

type EventListEditorProps = {
  title?: string;
  hint?: string;
  items: Array<{
    name: string;
    source: string;
    trigger: string;
    frequency?: string;
    latencySensitive?: boolean;
  }>;
  onChange: (items: EventListEditorProps["items"]) => void;
};

export const EventListEditor = ({
  title = "Events",
  hint = "Capture each meaningful trigger and its characteristics.",
  items,
  onChange,
}: EventListEditorProps) => {
  const updateItem = (index: number, key: string, value: string | boolean) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  return (
    <Field label={title} hint={hint}>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={`event-${index}`} className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4">
            <LabeledInput label="Event Name">
              <TextInput value={item.name} onChange={(value) => updateItem(index, "name", value)} placeholder="Event name" />
            </LabeledInput>
            <LabeledInput label="Source">
              <TextInput value={item.source} onChange={(value) => updateItem(index, "source", value)} placeholder="Source" />
            </LabeledInput>
            <LabeledInput label="Trigger">
              <TextInput value={item.trigger} onChange={(value) => updateItem(index, "trigger", value)} placeholder="Trigger" />
            </LabeledInput>
            <LabeledInput label="Frequency">
              <TextInput value={item.frequency ?? ""} onChange={(value) => updateItem(index, "frequency", value)} placeholder="Frequency" />
            </LabeledInput>
            <LabeledInput label="Latency Sensitivity">
              <Toggle checked={Boolean(item.latencySensitive)} onChange={(value) => updateItem(index, "latencySensitive", value)} label="Latency-sensitive event" />
            </LabeledInput>
            <Button
              onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}
              tone="danger"
              size="compact"
            >
              Remove Event
            </Button>
          </div>
        ))}
        <Button onClick={() => onChange([...items, { name: "", source: "", trigger: "", frequency: "", latencySensitive: false }])}>
          Add Event
        </Button>
      </div>
    </Field>
  );
};

type StateListEditorProps = {
  items: Array<{
    name: string;
    description: string;
    transitions: Array<{ event: string; targetState: string; action?: string }>;
  }>;
  onChange: (items: StateListEditorProps["items"]) => void;
};

export const StateListEditor = ({ items, onChange }: StateListEditorProps) => {
  const updateState = (index: number, key: string, value: string) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const updateTransition = (stateIndex: number, transitionIndex: number, key: string, value: string) => {
    const next = [...items];
    const transitions = [...next[stateIndex].transitions];
    transitions[transitionIndex] = { ...transitions[transitionIndex], [key]: value };
    next[stateIndex] = { ...next[stateIndex], transitions };
    onChange(next);
  };

  return (
    <Field label="States" hint="Model states and the transitions between them.">
      <div className="space-y-4">
        {items.map((item, stateIndex) => (
          <div key={`state-${stateIndex}`} className="space-y-3 rounded-2xl border border-slate/15 bg-mist/70 p-4">
            <LabeledInput label="State Name">
              <TextInput value={item.name} onChange={(value) => updateState(stateIndex, "name", value)} placeholder="State name" />
            </LabeledInput>
            <LabeledInput label="Description">
              <TextArea value={item.description} onChange={(value) => updateState(stateIndex, "description", value)} placeholder="What does this state represent?" rows={3} />
            </LabeledInput>
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/60 p-3">
              <p className="text-sm font-semibold text-ink">Transitions</p>
              {item.transitions.map((transition, transitionIndex) => (
                <div key={`transition-${stateIndex}-${transitionIndex}`} className="grid gap-2 rounded-xl border border-slate/10 bg-white p-3">
                  <LabeledInput label="Triggering Event">
                    <TextInput value={transition.event} onChange={(value) => updateTransition(stateIndex, transitionIndex, "event", value)} placeholder="Triggering event" />
                  </LabeledInput>
                  <LabeledInput label="Target State">
                    <TextInput value={transition.targetState} onChange={(value) => updateTransition(stateIndex, transitionIndex, "targetState", value)} placeholder="Target state" />
                  </LabeledInput>
                  <LabeledInput label="Action">
                    <TextInput value={transition.action ?? ""} onChange={(value) => updateTransition(stateIndex, transitionIndex, "action", value)} placeholder="Transition action" />
                  </LabeledInput>
                  <Button
                    onClick={() => {
                      const next = [...items];
                      next[stateIndex] = {
                        ...next[stateIndex],
                        transitions: next[stateIndex].transitions.filter((_, currentIndex) => currentIndex !== transitionIndex),
                      };
                      onChange(next);
                    }}
                    tone="danger"
                    size="compact"
                  >
                    Remove Transition
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => {
                  const next = [...items];
                  next[stateIndex] = {
                    ...next[stateIndex],
                    transitions: [...next[stateIndex].transitions, { event: "", targetState: "", action: "" }],
                  };
                  onChange(next);
                }}
              >
                Add Transition
              </Button>
            </div>
            <Button
              onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== stateIndex))}
              tone="danger"
              size="compact"
            >
              Remove State
            </Button>
          </div>
        ))}
        <Button onClick={() => onChange([...items, { name: "", description: "", transitions: [] }])}>Add State</Button>
      </div>
    </Field>
  );
};

type SimpleRow = Record<string, string | boolean>;

type ObjectListEditorProps<T extends SimpleRow> = {
  label: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  template: T;
  fields: Array<{
    key: keyof T;
    label: string;
    type?: "text" | "textarea" | "toggle" | "select";
    options?: string[];
  }>;
};

export const ObjectListEditor = <T extends SimpleRow>({
  label,
  hint,
  items,
  onChange,
  template,
  fields,
}: ObjectListEditorProps<T>) => {
  const updateItem = (index: number, key: keyof T, value: string | boolean) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4">
            {fields.map((field) => {
              const value = item[field.key];
              if (field.type === "textarea") {
                return (
                  <LabeledInput key={String(field.key)} label={field.label}>
                    <TextArea
                      value={String(value ?? "")}
                      onChange={(nextValue) => updateItem(index, field.key, nextValue)}
                      placeholder={field.label}
                      rows={3}
                    />
                  </LabeledInput>
                );
              }

              if (field.type === "toggle") {
                return (
                  <LabeledInput key={String(field.key)} label={field.label}>
                    <Toggle
                      checked={Boolean(value)}
                      onChange={(nextValue) => updateItem(index, field.key, nextValue)}
                      label={field.label}
                    />
                  </LabeledInput>
                );
              }

              if (field.type === "select" && field.options) {
                return (
                  <LabeledInput key={String(field.key)} label={field.label}>
                    <Select
                      value={String(value) as string}
                      onChange={(nextValue) => updateItem(index, field.key, nextValue)}
                      options={field.options}
                    />
                  </LabeledInput>
                );
              }

              return (
                <LabeledInput key={String(field.key)} label={field.label}>
                  <TextInput
                    value={String(value ?? "")}
                    onChange={(nextValue) => updateItem(index, field.key, nextValue)}
                    placeholder={field.label}
                  />
                </LabeledInput>
              );
            })}
            <Button
              onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}
              tone="danger"
              size="compact"
            >
              Remove
            </Button>
          </div>
        ))}
        <Button onClick={() => onChange([...items, { ...template }])}>Add Item</Button>
      </div>
    </Field>
  );
};
