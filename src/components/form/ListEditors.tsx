import { Button, Field, TextArea, TextInput, Toggle, Select } from "./FormControls";

type StringListEditorProps = {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
};

export const StringListEditor = ({ label, hint, items, onChange, placeholder }: StringListEditorProps) => {
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
          <div key={`${label}-${index}`} className="flex gap-2">
            <TextInput value={item} onChange={(value) => updateItem(index, value)} placeholder={placeholder} />
            <Button onClick={() => removeItem(index)} tone="ghost">
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
  items: Array<{
    name: string;
    source: string;
    trigger: string;
    frequency?: string;
    latencySensitive?: boolean;
  }>;
  onChange: (items: EventListEditorProps["items"]) => void;
};

export const EventListEditor = ({ items, onChange }: EventListEditorProps) => {
  const updateItem = (index: number, key: string, value: string | boolean) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  return (
    <Field label="Events" hint="Capture each meaningful trigger and its characteristics.">
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={`event-${index}`} className="grid gap-3 rounded-2xl border border-slate/15 bg-mist/70 p-4">
            <TextInput value={item.name} onChange={(value) => updateItem(index, "name", value)} placeholder="Event name" />
            <TextInput value={item.source} onChange={(value) => updateItem(index, "source", value)} placeholder="Source" />
            <TextInput value={item.trigger} onChange={(value) => updateItem(index, "trigger", value)} placeholder="Trigger" />
            <TextInput value={item.frequency ?? ""} onChange={(value) => updateItem(index, "frequency", value)} placeholder="Frequency" />
            <Toggle checked={Boolean(item.latencySensitive)} onChange={(value) => updateItem(index, "latencySensitive", value)} label="Latency-sensitive event" />
            <Button onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))} tone="ghost">
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
            <TextInput value={item.name} onChange={(value) => updateState(stateIndex, "name", value)} placeholder="State name" />
            <TextArea value={item.description} onChange={(value) => updateState(stateIndex, "description", value)} placeholder="What does this state represent?" rows={3} />
            <div className="space-y-3 rounded-2xl border border-white/70 bg-white/60 p-3">
              <p className="text-sm font-semibold text-ink">Transitions</p>
              {item.transitions.map((transition, transitionIndex) => (
                <div key={`transition-${stateIndex}-${transitionIndex}`} className="grid gap-2 rounded-xl border border-slate/10 bg-white p-3">
                  <TextInput value={transition.event} onChange={(value) => updateTransition(stateIndex, transitionIndex, "event", value)} placeholder="Triggering event" />
                  <TextInput value={transition.targetState} onChange={(value) => updateTransition(stateIndex, transitionIndex, "targetState", value)} placeholder="Target state" />
                  <TextInput value={transition.action ?? ""} onChange={(value) => updateTransition(stateIndex, transitionIndex, "action", value)} placeholder="Transition action" />
                  <Button
                    onClick={() => {
                      const next = [...items];
                      next[stateIndex] = {
                        ...next[stateIndex],
                        transitions: next[stateIndex].transitions.filter((_, currentIndex) => currentIndex !== transitionIndex),
                      };
                      onChange(next);
                    }}
                    tone="ghost"
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
            <Button onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== stateIndex))} tone="ghost">
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
                  <TextArea
                    key={String(field.key)}
                    value={String(value ?? "")}
                    onChange={(nextValue) => updateItem(index, field.key, nextValue)}
                    placeholder={field.label}
                    rows={3}
                  />
                );
              }

              if (field.type === "toggle") {
                return (
                  <Toggle
                    key={String(field.key)}
                    checked={Boolean(value)}
                    onChange={(nextValue) => updateItem(index, field.key, nextValue)}
                    label={field.label}
                  />
                );
              }

              if (field.type === "select" && field.options) {
                return (
                  <Select
                    key={String(field.key)}
                    value={String(value) as string}
                    onChange={(nextValue) => updateItem(index, field.key, nextValue)}
                    options={field.options}
                  />
                );
              }

              return (
                <TextInput
                  key={String(field.key)}
                  value={String(value ?? "")}
                  onChange={(nextValue) => updateItem(index, field.key, nextValue)}
                  placeholder={field.label}
                />
              );
            })}
            <Button onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))} tone="ghost">
              Remove
            </Button>
          </div>
        ))}
        <Button onClick={() => onChange([...items, { ...template }])}>Add Item</Button>
      </div>
    </Field>
  );
};
