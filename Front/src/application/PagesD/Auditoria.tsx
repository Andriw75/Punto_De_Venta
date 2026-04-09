import { For, Show, createMemo, createSignal, onMount, type Component } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Pagination from "../common/components/Pagination";
import LoadingLoop from "../common/IconSvg/LoadingLoop";
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

const LIMIT = 20;

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

const actionLabel = (value: AuditActionType) => {
  if (value === "INSERT") return "Alta";
  if (value === "UPDATE") return "Actualización";
  if (value === "DELETE") return "Eliminación";
  return "Migración";
};

const entityLabel = (value: AuditEntityType) => {
  if (value === "USER") return "Usuario";
  if (value === "CATEGORY") return "Categoría";
  if (value === "PRODUCT") return "Producto";
  if (value === "PAYMENT_METHOD") return "Método pago";
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
  const [username, setUsername] = createSignal("");
  const [entityType, setEntityType] = createSignal<"" | AuditEntityType>("");
  const [actionType, setActionType] = createSignal<"" | AuditActionType>("");

  const [usernames, setUsernames] = createSignal<string[]>([]);
  const [logs, setLogs] = createSignal<AuditLogResponse[]>([]);

  const totalPages = createMemo(() =>
    totalCount() > 0 ? Math.ceil(totalCount() / LIMIT) : 0,
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
      username: username() || undefined,
      entity_type: entityType() || undefined,
      action_type: actionType() || undefined,
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
    setUsername("");
    setEntityType("");
    setActionType("");
    setPage(1);
    await fetchPage(1);
  };

  const handleOnlyDeletedUsers = async () => {
    setEntityType("USER");
    setActionType("DELETE");
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
      <div class={styles.toolbar}>
        <div>
          <h1 class={styles.title}>Auditoría</h1>
          <p class={styles.subtitle}>Historial de cambios del sistema (solo lectura)</p>
        </div>

        <div class={styles.filters}>
          <div class={styles.field}>
            <label class={styles.label}>Inicio</label>
            <input
              type="datetime-local"
              class={styles.input}
              value={startTime()}
              onInput={(e) => setStartTime(e.currentTarget.value)}
            />
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Fin</label>
            <input
              type="datetime-local"
              class={styles.input}
              value={endTime()}
              onInput={(e) => setEndTime(e.currentTarget.value)}
            />
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Usuario</label>
            <select
              class={styles.select}
              value={username()}
              onChange={(e) => setUsername(e.currentTarget.value)}
            >
              <option value="">Todos</option>
              <For each={usernames()}>{(u) => <option value={u}>{u}</option>}</For>
            </select>
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Entidad</label>
            <select
              class={styles.select}
              value={entityType()}
              onChange={(e) => setEntityType(e.currentTarget.value as "" | AuditEntityType)}
            >
              <option value="">Todas</option>
              <For each={AUDIT_ENTITY_TYPES}>
                {(entity) => <option value={entity}>{entityLabel(entity)}</option>}
              </For>
            </select>
          </div>

          <div class={styles.field}>
            <label class={styles.label}>Acción</label>
            <select
              class={styles.select}
              value={actionType()}
              onChange={(e) => setActionType(e.currentTarget.value as "" | AuditActionType)}
            >
              <option value="">Todas</option>
              <For each={AUDIT_ACTION_TYPES}>
                {(action) => <option value={action}>{actionLabel(action)}</option>}
              </For>
            </select>
          </div>
        </div>

        <div class={styles.actions}>
          <button class={styles.btnPrimary} disabled={loading()} onClick={handleSearch}>
            {loading() ? "Consultando..." : "Consultar"}
          </button>
          <button class={styles.btnSoft} disabled={loading()} onClick={handleReset}>
            Limpiar
          </button>
          <button class={styles.btnSoft} disabled={loading()} onClick={handleOnlyDeletedUsers}>
            Solo usuarios eliminados
          </button>
        </div>

        <div class={styles.meta}>Registros: {totalCount()}</div>
      </div>

      <Show
        when={!loading()}
        fallback={<LoadingLoop width="100%" height="14rem" />}
      >
        <div class={styles.tableWrap}>
          <table class={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Entidad</th>
                <th>Acción</th>
                <th>ID Entidad</th>
                <th>Descripción</th>
                <th>Cambios</th>
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
                      <details class={styles.changes}>
                        <summary>Ver detalle</summary>
                        <pre class={styles.jsonBlock}>
                          {JSON.stringify(row.changes, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>

          <Show when={logs().length === 0}>
            <div class={styles.emptyState}>No se encontraron registros de auditoría</div>
          </Show>
        </div>

        <Show when={totalPages() > 1}>
          <Pagination
            currentPage={page()}
            totalPages={totalPages()}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              void fetchPage(nextPage);
            }}
          />
        </Show>
      </Show>
    </div>
  );
};

export default Auditoria;
