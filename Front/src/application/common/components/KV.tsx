import { Index, Show, createEffect, createMemo, createSignal, type Component } from "solid-js";
import styles from "./KV.module.css";

export type KVItem = {
  id: string;
  key: string;
  value: string;
};

export type KVValidationErrors = {
  key?: string;
  value?: string;
};

type KVProps = {
  items: KVItem[];
  onChange: (items: KVItem[]) => void;
  disabled?: boolean;
  class?: string;
  classList?: Record<string, boolean | undefined>;
  keyLabel?: string;
  valueLabel?: string;
  addLabel?: string;
  emptyText?: string;
  validate?: (item: KVItem, index: number, items: KVItem[]) => KVValidationErrors | null;
  onValidityChange?: (isValid: boolean) => void;
};

function reorderItems(items: KVItem[], sourceId: string, targetId: string) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

const KV: Component<KVProps> = (props) => {
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [dragOverId, setDragOverId] = createSignal<string | null>(null);

  const showHead = createMemo(() => Boolean(props.keyLabel || props.valueLabel));

  const rowErrors = createMemo(() =>
    props.items.map((item, index) =>
      props.validate?.(item, index, props.items) ?? null,
    ),
  );

  const isValid = createMemo(() =>
    rowErrors().every((err) => !err || (!err.key && !err.value)),
  );

  createEffect(() => {
    props.onValidityChange?.(isValid());
  });

  const updateItem = (index: number, field: "key" | "value", value: string) => {
    const next = [...props.items];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, [field]: value };
    props.onChange(next);
  };

  const createRowId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const addItem = () => {
    props.onChange([
      ...props.items,
      {
        id: createRowId(),
        key: "",
        value: "",
      },
    ]);
  };

  const removeItem = (id: string) => {
    props.onChange(props.items.filter((item) => item.id !== id));
  };

  const handleDrop = (targetId: string) => {
    const sourceId = draggingId();
    if (!sourceId) return;

    props.onChange(reorderItems(props.items, sourceId, targetId));
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <section
      class={`${styles.wrapper}${props.class ? ` ${props.class}` : ""}`}
      classList={{
        ...(props.classList ?? {}),
      }}
    >
      <Show when={showHead()}>
        <div class={styles.headRow}>
          <span class={styles.label}>{props.keyLabel}</span>
          <span class={styles.label}>{props.valueLabel}</span>
        </div>
      </Show>

      <Show
        when={props.items.length > 0}
        fallback={<div class={styles.empty}>{props.emptyText ?? "Sin metadata"}</div>}
      >
        <div class={styles.list}>
          <Index each={props.items}>
            {(item, index) => {
              const row = () => item();
              const errors = () => rowErrors()[index];
              return (
                <div
                  class={styles.item}
                  classList={{
                    [styles.dragOver]: dragOverId() === row().id,
                    [styles.errorRow]: Boolean(errors()?.key || errors()?.value),
                  }}
                  draggable={!props.disabled}
                  onDragStart={() => {
                    if (props.disabled) return;
                    setDraggingId(row().id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  onDragOver={(event) => {
                    if (props.disabled) return;
                    event.preventDefault();
                    setDragOverId(row().id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId() === row().id) setDragOverId(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (props.disabled) return;
                    handleDrop(row().id);
                  }}
                >
                  <button
                    type="button"
                    class={styles.dragHandle}
                    disabled={props.disabled}
                    title="Arrastrar"
                  >
                    ||
                  </button>

                  <div class={styles.fieldWrap}>
                    <input
                      class={styles.input}
                      value={row().key}
                      onInput={(event) =>
                        updateItem(index, "key", event.currentTarget.value)
                      }
                      placeholder="ej: tipo"
                      disabled={props.disabled}
                    />
                    <Show when={errors()?.key}>
                      <span class={styles.errorText}>{errors()?.key}</span>
                    </Show>
                  </div>

                  <div class={styles.fieldWrap}>
                    <input
                      class={styles.input}
                      value={row().value}
                      onInput={(event) =>
                        updateItem(index, "value", event.currentTarget.value)
                      }
                      placeholder="ej: premium"
                      disabled={props.disabled}
                    />
                    <Show when={errors()?.value}>
                      <span class={styles.errorText}>{errors()?.value}</span>
                    </Show>
                  </div>

                  <button
                    type="button"
                    class={styles.removeButton}
                    onClick={() => removeItem(row().id)}
                    disabled={props.disabled}
                  >
                    Eliminar
                  </button>
                </div>
              );
            }}
          </Index>
        </div>
      </Show>

      <button
        type="button"
        class={styles.addButton}
        onClick={addItem}
        disabled={props.disabled}
      >
        {props.addLabel ?? "Agregar fila"}
      </button>
    </section>
  );
};

export default KV;
