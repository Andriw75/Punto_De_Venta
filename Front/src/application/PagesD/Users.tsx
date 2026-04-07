import { For, Show, createMemo, createSignal, onMount, type Component } from "solid-js";
import { useNavigate } from "@solidjs/router";
import styles from "./Users.module.css";
import LoadingLoop from "../common/IconSvg/LoadingLoop";
import Pagination from "../common/components/Pagination";
import { addToast } from "../common/UI/Toast/toastStore";
import { confirmWithOptions } from "../common/UI/Confirm/confirmStore";
import { useAuth } from "../context/auth";
import type { UserAdmin } from "../../domain/users";
import { deleteUser, fetchUsers, fetchUsersCount } from "../../infrastructure/users";
import { ModCUUser } from "../components/Users/ModCUUser";
import { normalize } from "./utils";

const LIMIT = 15;

const toApiDateTime = (value: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const Users: Component = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [page, setPage] = createSignal(1);
  const [totalCount, setTotalCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const [startTime, setStartTime] = createSignal("");
  const [endTime, setEndTime] = createSignal("");
  const [searchName, setSearchName] = createSignal("");

  const [users, setUsers] = createSignal<UserAdmin[]>([]);
  const [showModal, setShowModal] = createSignal(false);
  const [selectedUser, setSelectedUser] = createSignal<UserAdmin | null>(null);
  const [deleteComment, setDeleteComment] = createSignal("");

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

  const userItems = createMemo(() => {
    const query = normalize(searchName());

    return [...users()]
      .map((user) => ({
        user,
        matches: !query || user.name.toLowerCase().includes(query),
      }))
      .sort((a, b) => {
        if (a.matches !== b.matches) return a.matches ? -1 : 1;
        return a.user.name.localeCompare(b.user.name, "es", { sensitivity: "base" });
      });
  });

  const fetchPage = async (targetPage = page()) => {
    setLoading(true);

    const safePage = Math.max(1, targetPage);
    const offset = (safePage - 1) * LIMIT;
    const start = toApiDateTime(startTime());
    const end = toApiDateTime(endTime());

    const [countRes, listRes] = await Promise.all([
      fetchUsersCount({ start_time: start, end_time: end }),
      fetchUsers({ offset, limit: LIMIT, start_time: start, end_time: end }),
    ]);

    if (countRes.error) {
      await handleApiError(countRes.error.status, countRes.error.detail);
      setUsers([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    if (listRes.error) {
      await handleApiError(listRes.error.status, listRes.error.detail);
      setUsers([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setTotalCount(countRes.data);
    setUsers(listRes.data);
    if (safePage !== page()) setPage(safePage);
    setLoading(false);
  };

  const handleSearch = async () => {
    setPage(1);
    await fetchPage(1);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    void fetchPage(nextPage);
  };

  const handleDelete = async (user: UserAdmin) => {
    setDeleteComment("");

    const result = await confirmWithOptions({
      title: "Atención",
      message: `¿Seguro de eliminar al usuario ${user.name}?`,
      confirmText: "Eliminar",
      content: (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label style={{ color: "#52525b", "font-size": "0.9rem" }}>
            Comentario (opcional)
          </label>
          <textarea
            value={deleteComment()}
            maxLength={200}
            placeholder="Motivo de eliminación..."
            onInput={(e) => setDeleteComment(e.currentTarget.value)}
            style={{
              "min-height": "5.5rem",
              resize: "vertical",
              border: "1px solid #d4d4d8",
              "border-radius": "8px",
              padding: "0.6rem 0.7rem",
              "font-size": "0.92rem",
              "font-family": "inherit",
            }}
          />
        </div>
      ),
      fn: async () => await deleteUser(user.id, deleteComment().trim() || undefined),
    });

    if (result === null) return;

    if (result.error) {
      await handleApiError(result.error.status, `Error al eliminar: ${result.error.detail}`);
      return;
    }

    addToast({ message: "Usuario eliminado", type: "success" });

    const currentPage = page();
    const hasOneItem = users().length === 1;
    if (hasOneItem && currentPage > 1) {
      await fetchPage(currentPage - 1);
      return;
    }

    await fetchPage(currentPage);
  };

  onMount(async () => {
    setPage(1);
    setStartTime("");
    setEndTime("");
    await fetchPage(1);
  });

  return (
    <>
      <div class={styles.container}>
        <div class={styles.toolbar}>
          <div class={styles.titleBlock}>
            <h1 class={styles.title}>Usuarios</h1>
            <p class={styles.subtitle}>Gestión de cuentas administrativas</p>
          </div>

          <div class={styles.toolbarActions}>
            <div class={styles.filterFieldSearch}>
              <label class={styles.label}>Buscar usuario</label>
              <input
                type="text"
                class={styles.input}
                value={searchName()}
                placeholder="Nombre..."
                onInput={(e) => setSearchName(e.currentTarget.value)}
              />
            </div>

            <div class={styles.filterField}>
              <label class={styles.label}>Inicio</label>
              <input
                type="datetime-local"
                class={styles.input}
                value={startTime()}
                onInput={(e) => setStartTime(e.currentTarget.value)}
              />
            </div>

            <div class={styles.filterField}>
              <label class={styles.label}>Fin</label>
              <input
                type="datetime-local"
                class={styles.input}
                value={endTime()}
                onInput={(e) => setEndTime(e.currentTarget.value)}
              />
            </div>

            <button class={styles.btnSearch} onClick={handleSearch} disabled={loading()}>
              {loading() ? "Buscando..." : "Buscar"}
            </button>

            <button
              class={styles.btnPrimary}
              onClick={() => {
                setSelectedUser(null);
                setShowModal(true);
              }}
            >
              Crear usuario
            </button>
          </div>
        </div>

        <Show
          when={!loading()}
          fallback={
            <div class={styles.loadingWrap}>
              <LoadingLoop width="100%" height="20rem" />
            </div>
          }
        >
          <div class={styles.grid}>
            <For each={userItems()}>
              {(item) => (
              <article
                class={styles.card}
                classList={{ [styles.disabledCard]: !item.matches }}
              >
                <div class={styles.cardHeader}>
                  <div>
                    <h3 class={styles.cardTitle}>{item.user.name}</h3>
                  </div>

                  <div class={styles.actions}>
                    <button
                      class={styles.iconBtn}
                      onClick={() => {
                        setSelectedUser(item.user);
                        setShowModal(true);
                      }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      class={styles.iconBtn}
                      onClick={() => void handleDelete(item.user)}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <p class={styles.permissionsTitle}>Permisos</p>
                <div class={styles.permissionsWrap}>
                  {item.user.permissions.length > 0 ? (
                    item.user.permissions.map((perm) => (
                      <span class={styles.permissionBadge}>{perm}</span>
                    ))
                  ) : (
                    <span class={styles.emptyPerms}>Sin permisos</span>
                  )}
                </div>
              </article>
              )}
            </For>
          </div>

          <Show when={users().length === 0}>
            <p class={styles.emptyState}>No se encontraron usuarios</p>
          </Show>

          <Show when={totalPages() > 1}>
            <Pagination
              currentPage={page()}
              totalPages={totalPages()}
              onPageChange={handlePageChange}
            />
          </Show>
        </Show>
      </div>

      <Show when={showModal()}>
        <ModCUUser
          user={selectedUser()}
          onClose={() => {
            setShowModal(false);
            setSelectedUser(null);
          }}
          onSaved={async () => {
            await fetchPage(page());
          }}
        />
      </Show>
    </>
  );
};

export default Users;
