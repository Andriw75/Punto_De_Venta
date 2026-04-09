import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import Pagination from "../common/components/Pagination";
import LoadingLoop from "../common/IconSvg/LoadingLoop";
import ModalCommon from "../common/UI/ModalCommon";
import { addToast } from "../common/UI/Toast/toastStore";
import { useAuth } from "../context/auth";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  type AuditActionType,
  type AuditEntityType,
  type AuditLogResponse,
} from "../../domain/audit";
import {
  fetchAuditCount,
  fetchAuditLogs,
  fetchAuditUsernames,
} from "../../infrastructure/audit";
import styles from "./Auditoria.module.css";
import EyeInSpeechBubble from "../common/IconSvg/EyeInSpeechBubble";

const LIMIT = 20;

type MultiOption<T extends string> = {
  value: T;
  label: string;
};

type DiffStatus = "added" | "removed" | "changed" | "unchanged";

type DiffRow = {
  key: string;
  status: DiffStatus;
  beforeValue: unknown;
  afterValue: unknown;
};

type MultiSelectFilterProps<T extends string> = {
  label: string;
  placeholder: string;
  options: MultiOption<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
  disabled?: boolean;
};

const MultiSelectFilter = <T extends string>(props: MultiSelectFilterProps<T>) => {
  const [open, setOpen] = createSignal(false);
  let wrapperRef: HTMLDivElement | undefined;

  const selectedSet = createMemo(() => new Set(props.selected));

  const selectedText = createMemo(() => {
    if (props.selected.length === 0) return props.placeholder;
    if (props.selected.length === 1) {
      return props.options.find((item) => item.value === props.selected[0])?.label ??
        props.selected[0];
    }
    return `${props.selected.length} seleccionados`;
  });

  const toggleValue = (value: T, checked: boolean) => {
    if (checked) {
      const next = [...props.selected, value];
      props.onChange([...new Set(next)]);
      return;
    }

    props.onChange(props.selected.filter((item) => item !== value));
  };

  const handleOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!wrapperRef?.contains(target)) {
      setOpen(false);
    }
  };

  document.addEventListener("mousedown", handleOutside);
  onCleanup(() => {
    document.removeEventListener("mousedown", handleOutside);
  });

  return (
    <div class={styles.field} ref={wrapperRef}>
      <label class={styles.label}>{props.label}</label>

      <button
        type="button"
        class={styles.multiTrigger}
        classList={{ [styles.multiTriggerOpen]: open() }}
        onClick={() => !props.disabled && setOpen((prev) => !prev)}
        disabled={props.disabled}
      >
        <span class={styles.multiValue}>{selectedText()}</span>
        <span class={styles.multiArrow}>{open() ? "▴" : "▾"}</span>
      </button>

      <Show when={open()}>
        <div class={styles.multiMenu}>
          <div class={styles.multiActions}>
            <button
              type="button"
              class={styles.multiActionBtn}
              onClick={() => props.onChange(props.options.map((item) => item.value))}
            >
              Todos
            </button>
            <button
              type="button"
              class={styles.multiActionBtn}
              onClick={() => props.onChange([])}
            >
              Limpiar
            </button>
          </div>

          <div class={styles.multiList}>
            <For each={props.options}>
              {(option) => (
                <label class={styles.multiItem}>
                  <input
                    type="checkbox"
                    checked={selectedSet().has(option.value)}
                    onChange={(e) => toggleValue(option.value, e.currentTarget.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

const toApiDateTime = (value: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const toObjectRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

const normalizeForCompare = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCompare(item));
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(input).sort((a, b) => a.localeCompare(b))) {
      output[key] = normalizeForCompare(input[key]);
    }

    return output;
  }

  return value;
};

const valuesAreEqual = (a: unknown, b: unknown) => {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
};

const formatValue = (value: unknown) => {
  if (value === undefined) return "-";
  if (value === null) return "null";
  if (typeof value === "string") return value.length > 0 ? value : '""';
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
};

const buildDiffRows = (row: AuditLogResponse): DiffRow[] => {
  const before = toObjectRecord(row.changes?.data_before);
  const after = toObjectRecord(row.changes?.data_after);

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort((a, b) =>
    a.localeCompare(b),
  );

  return keys.map((key) => {
    const hasBefore = Object.prototype.hasOwnProperty.call(before, key);
    const hasAfter = Object.prototype.hasOwnProperty.call(after, key);

    if (!hasBefore && hasAfter) {
      return {
        key,
        status: "added" as const,
        beforeValue: undefined,
        afterValue: after[key],
      };
    }

    if (hasBefore && !hasAfter) {
      return {
        key,
        status: "removed" as const,
        beforeValue: before[key],
        afterValue: undefined,
      };
    }

    const beforeValue = before[key];
    const afterValue = after[key];
    const status: DiffStatus = valuesAreEqual(beforeValue, afterValue) ? "unchanged" : "changed";

    return {
      key,
      status,
      beforeValue,
      afterValue,
    };
  });
};

const actionLabel = (value: AuditActionType) => {
  if (value === "INSERT") return "Alta";
  if (value === "UPDATE") return "Actualizacion";
  if (value === "DELETE") return "Eliminacion";
  return "Migracion";
};

const entityLabel = (value: AuditEntityType) => {
  if (value === "USER") return "Usuario";
  if (value === "CATEGORY") return "Categoria";
  if (value === "PRODUCT") return "Producto";
  if (value === "PAYMENT_METHOD") return "Metodo pago";
  return "Venta";
};

const actionChipClass = (value: AuditActionType) => {
  if (value === "INSERT") return styles.chipInsert;
  if (value === "UPDATE") return styles.chipUpdate;
  if (value === "DELETE") return styles.chipDelete;
  return styles.chipMigrate;
};

const Auditoria: Component = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [page, setPage] = createSignal(1);
  const [totalCount, setTotalCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const [startTime, setStartTime] = createSignal("");
  const [endTime, setEndTime] = createSignal("");
  const [selectedUsers, setSelectedUsers] = createSignal<string[]>([]);
  const [selectedEntities, setSelectedEntities] = createSignal<AuditEntityType[]>([]);
  const [selectedActions, setSelectedActions] = createSignal<AuditActionType[]>([]);

  const [usernames, setUsernames] = createSignal<string[]>([]);
  const [logs, setLogs] = createSignal<AuditLogResponse[]>([]);
  const [selectedLog, setSelectedLog] = createSignal<AuditLogResponse | null>(null);

  const [showAdded, setShowAdded] = createSignal(true);
  const [showRemoved, setShowRemoved] = createSignal(true);
  const [showChanged, setShowChanged] = createSignal(true);
  const [showUnchanged, setShowUnchanged] = createSignal(false);

  const totalPages = createMemo(() =>
    totalCount() > 0 ? Math.ceil(totalCount() / LIMIT) : 0,
  );

  const usernameOptions = createMemo<MultiOption<string>[]>(() =>
    usernames().map((item) => ({ value: item, label: item })),
  );

  const entityOptions = createMemo<MultiOption<AuditEntityType>[]>(() =>
    AUDIT_ENTITY_TYPES.map((item) => ({ value: item, label: entityLabel(item) })),
  );

  const actionOptions = createMemo<MultiOption<AuditActionType>[]>(() =>
    AUDIT_ACTION_TYPES.map((item) => ({ value: item, label: actionLabel(item) })),
  );

  const selectedRows = createMemo(() => {
    const current = selectedLog();
    if (!current) return [];
    return buildDiffRows(current);
  });

  const countsByStatus = createMemo(() => {
    const counts: Record<DiffStatus, number> = {
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 0,
    };

    for (const row of selectedRows()) {
      counts[row.status] += 1;
    }

    return counts;
  });

  const filteredRows = createMemo(() =>
    selectedRows().filter((row) => {
      if (row.status === "added") return showAdded();
      if (row.status === "removed") return showRemoved();
      if (row.status === "changed") return showChanged();
      return showUnchanged();
    }),
  );

  const handleApiError = async (status: number, detail: string) => {
    if (status === 401) {
      await logout(false);
      navigate("/login");
      return;
    }
    addToast({ message: detail, type: "error" });
  };

  const fetchPage = async (targetPage = page()) => {
    setLoading(true);

    const safePage = Math.max(1, targetPage);
    const offset = (safePage - 1) * LIMIT;

    const filters = {
      start_time: toApiDateTime(startTime()),
      end_time: toApiDateTime(endTime()),
      username: selectedUsers().length > 0 ? selectedUsers() : undefined,
      entity_type: selectedEntities().length > 0 ? selectedEntities() : undefined,
      action_type: selectedActions().length > 0 ? selectedActions() : undefined,
    };

    const [countRes, listRes] = await Promise.all([
      fetchAuditCount(filters),
      fetchAuditLogs({ ...filters, offset, limit: LIMIT }),
    ]);

    if (countRes.error) {
      await handleApiError(countRes.error.status, countRes.error.detail);
      setLogs([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    if (listRes.error) {
      await handleApiError(listRes.error.status, listRes.error.detail);
      setLogs([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setTotalCount(countRes.data);
    setLogs(listRes.data);
    if (safePage !== page()) setPage(safePage);
    setLoading(false);
  };

  const handleSearch = async () => {
    setPage(1);
    await fetchPage(1);
  };

  const handleReset = async () => {
    setStartTime("");
    setEndTime("");
    setSelectedUsers([]);
    setSelectedEntities([]);
    setSelectedActions([]);
    setPage(1);
    await fetchPage(1);
  };

  onMount(async () => {
    const usersRes = await fetchAuditUsernames();
    if (usersRes.error) {
      await handleApiError(usersRes.error.status, usersRes.error.detail);
    } else {
      setUsernames(usersRes.data);
    }

    await fetchPage(1);
  });

  return (
    <div class={styles.container}>
      <section class={styles.toolbarCard}>
        <div class={styles.header}>
          <div>
            <h1 class={styles.title}>Auditoria</h1>
            <p class={styles.subtitle}>Consulta historica de cambios del sistema</p>
          </div>
          <div class={styles.metaPill}>Total: {totalCount()}</div>
        </div>

        <div class={styles.filtersGrid}>
          <div class={styles.field}>
            <label class={styles.label}>Fecha inicio</label>
            <input
              type="datetime-local"
              class={styles.input}
              value={startTime()}
              onInput={(e) => setStartTime(e.currentTarget.value)}
            />
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Fecha fin</label>
            <input
              type="datetime-local"
              class={styles.input}
              value={endTime()}
              onInput={(e) => setEndTime(e.currentTarget.value)}
            />
          </div>

          <MultiSelectFilter
            label="Usuarios"
            placeholder="Todos los usuarios"
            options={usernameOptions()}
            selected={selectedUsers()}
            onChange={setSelectedUsers}
            disabled={loading()}
          />

          <MultiSelectFilter
            label="Entidades"
            placeholder="Todas las entidades"
            options={entityOptions()}
            selected={selectedEntities()}
            onChange={setSelectedEntities}
            disabled={loading()}
          />

          <MultiSelectFilter
            label="Acciones"
            placeholder="Todas las acciones"
            options={actionOptions()}
            selected={selectedActions()}
            onChange={setSelectedActions}
            disabled={loading()}
          />
        </div>

        <div class={styles.actions}>
          <button class={styles.btnPrimary} disabled={loading()} onClick={handleSearch}>
            {loading() ? "Consultando..." : "Aplicar filtros"}
          </button>
          <button class={styles.btnSoft} disabled={loading()} onClick={handleReset}>
            Limpiar filtros
          </button>
        </div>
      </section>

      <section class={styles.tableCard}>
        <Show when={!loading()} fallback={<LoadingLoop width="100%" height="15rem" />}>
          <div class={styles.tableWrap}>
            <table class={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Entidad</th>
                  <th>Accion</th>
                  <th>ID</th>
                  <th>Descripcion</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                <For each={logs()}>
                  {(row) => (
                    <tr>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td>{row.username || "-"}</td>
                      <td>
                        <span class={`${styles.chip} ${styles.chipEntity}`}>
                          {entityLabel(row.entity_type)}
                        </span>
                      </td>
                      <td>
                        <span class={`${styles.chip} ${actionChipClass(row.action_type)}`}>
                          {actionLabel(row.action_type)}
                        </span>
                      </td>
                      <td>{row.entity_id || "-"}</td>
                      <td>{row.description || "-"}</td>
                      <td>
                        <button
                          class={styles.viewBtn}
                          onClick={() => {
                            setSelectedLog(row);
                            setShowAdded(true);
                            setShowRemoved(true);
                            setShowChanged(true);
                            setShowUnchanged(false);
                          }}
                          title="Ver detalle de cambios"
                        >
                          <EyeInSpeechBubble />
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            <Show when={logs().length === 0}>
              <div class={styles.emptyState}>No hay resultados para los filtros actuales</div>
            </Show>
          </div>

          <Show when={totalPages() > 1}>
            <div class={styles.paginationWrap}>
              <Pagination
                currentPage={page()}
                totalPages={totalPages()}
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  void fetchPage(nextPage);
                }}
              />
            </div>
          </Show>
        </Show>
      </section>

      <Show when={selectedLog() !== null}>
        <ModalCommon onClose={() => setSelectedLog(null)} width="min(1120px, 96vw)">
          <div class={styles.modalContainer}>
            <div class={styles.modalHeader}>
              <h3 class={styles.modalTitle}>Detalle de cambios</h3>
              <div class={styles.modalMeta}>
                <span>{formatDateTime(selectedLog()!.created_at)}</span>
                <span>{selectedLog()!.username || "-"}</span>
                <span>{entityLabel(selectedLog()!.entity_type)}</span>
                <span>{actionLabel(selectedLog()!.action_type)}</span>
              </div>
            </div>

            <div class={styles.legendRow}>
              <label class={styles.legendItem}>
                <input
                  type="checkbox"
                  checked={showAdded()}
                  onChange={(e) => setShowAdded(e.currentTarget.checked)}
                />
                <span class={`${styles.legendChip} ${styles.legendAdded}`}>
                  Agregados ({countsByStatus().added})
                </span>
              </label>

              <label class={styles.legendItem}>
                <input
                  type="checkbox"
                  checked={showRemoved()}
                  onChange={(e) => setShowRemoved(e.currentTarget.checked)}
                />
                <span class={`${styles.legendChip} ${styles.legendRemoved}`}>
                  Eliminados ({countsByStatus().removed})
                </span>
              </label>

              <label class={styles.legendItem}>
                <input
                  type="checkbox"
                  checked={showChanged()}
                  onChange={(e) => setShowChanged(e.currentTarget.checked)}
                />
                <span class={`${styles.legendChip} ${styles.legendChanged}`}>
                  Editados ({countsByStatus().changed})
                </span>
              </label>

              <label class={styles.legendItem}>
                <input
                  type="checkbox"
                  checked={showUnchanged()}
                  onChange={(e) => setShowUnchanged(e.currentTarget.checked)}
                />
                <span class={`${styles.legendChip} ${styles.legendUnchanged}`}>
                  Sin cambios ({countsByStatus().unchanged})
                </span>
              </label>
            </div>

            <div class={styles.diffTableWrap}>
              <table class={styles.diffTable}>
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Antes</th>
                    <th>Despues</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filteredRows()}>
                    {(item) => (
                      <tr
                        class={styles.diffRow}
                        classList={{
                          [styles.diffAdded]: item.status === "added",
                          [styles.diffRemoved]: item.status === "removed",
                          [styles.diffChanged]: item.status === "changed",
                          [styles.diffUnchanged]: item.status === "unchanged",
                        }}
                      >
                        <td class={styles.diffKey}>{item.key}</td>
                        <td>
                          <pre class={styles.diffValue}>{formatValue(item.beforeValue)}</pre>
                        </td>
                        <td>
                          <pre class={styles.diffValue}>{formatValue(item.afterValue)}</pre>
                        </td>
                        <td>
                          <span class={styles.statusBadge}>
                            {item.status === "added"
                              ? "Agregado"
                              : item.status === "removed"
                                ? "Eliminado"
                                : item.status === "changed"
                                  ? "Editado"
                                  : "Sin cambios"}
                          </span>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>

              <Show when={filteredRows().length === 0}>
                <div class={styles.emptyDiffState}>
                  No hay atributos visibles con los filtros del diff.
                </div>
              </Show>
            </div>
          </div>
        </ModalCommon>
      </Show>
    </div>
  );
};

export default Auditoria;
