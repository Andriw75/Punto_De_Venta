import { For, Show, createMemo, createSignal, onMount, type Component } from "solid-js";
import { useNavigate } from "@solidjs/router";
import LoadingLoop from "../common/IconSvg/LoadingLoop";
import Pagination from "../common/components/Pagination";
import { confirm } from "../common/UI/Confirm/confirmStore";
import { addToast } from "../common/UI/Toast/toastStore";
import { useAuth } from "../context/auth";
import { useWebSocket } from "../context/web_socket";
import type { SaleResponse } from "../../domain/sales";
import { deleteSale, fetchSales, fetchSalesCount } from "../../infrastructure/sales";
import { normalize } from "./utils";
import VentaCU from "../components/Sales/VentaCU";
import { ModCUProd } from "../components/Products/ModCUProd";
import styles from "./Sales.module.css";

const LIMIT = 12;

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
  });
};

const Sales: Component = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentPaymentMethods } = useWebSocket();

  const [page, setPage] = createSignal(1);
  const [totalCount, setTotalCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const [startTime, setStartTime] = createSignal("");
  const [endTime, setEndTime] = createSignal("");
  const [searchText, setSearchText] = createSignal("");

  const [sales, setSales] = createSignal<SaleResponse[]>([]);
  const [selectedSale, setSelectedSale] = createSignal<SaleResponse | null | undefined>(undefined);
  const [showCreateProductModal, setShowCreateProductModal] = createSignal(false);
  const [createProductPrefill, setCreateProductPrefill] = createSignal<{ name?: string; barcode?: string }>({});

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

  const methodNameById = (methodId: number) => {
    const method = currentPaymentMethods().find((item) => item.id === methodId);
    return method?.name ?? `Método #${methodId}`;
  };

  const saleItems = createMemo(() => {
    const query = normalize(searchText());

    return [...sales()]
      .map((sale) => {
        const userName = normalize(sale.username ?? "");
        const methodName = normalize(methodNameById(sale.payment_method_id));
        const matches =
          !query ||
          String(sale.id).includes(query) ||
          userName.includes(query) ||
          methodName.includes(query);

        return {
          sale,
          matches,
        };
      })
      .sort((a, b) => {
        if (a.matches !== b.matches) return a.matches ? -1 : 1;
        return b.sale.id - a.sale.id;
      });
  });

  const fetchPage = async (targetPage = page()) => {
    setLoading(true);

    const safePage = Math.max(1, targetPage);
    const offset = (safePage - 1) * LIMIT;
    const start = toApiDateTime(startTime());
    const end = toApiDateTime(endTime());

    const [countRes, listRes] = await Promise.all([
      fetchSalesCount({ start_time: start, end_time: end }),
      fetchSales({ offset, limit: LIMIT, start_time: start, end_time: end }),
    ]);

    if (countRes.error) {
      await handleApiError(countRes.error.status, countRes.error.detail);
      setSales([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    if (listRes.error) {
      await handleApiError(listRes.error.status, listRes.error.detail);
      setSales([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setTotalCount(countRes.data);
    setSales(listRes.data);
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

  const handleDelete = async (sale: SaleResponse) => {
    const result = await confirm(
      "Atención",
      `¿Seguro de eliminar la venta #${sale.id}? (sin restaurar stock)`,
      async () => await deleteSale(sale.id, false),
    );

    if (result === null) return;

    if (result.error) {
      await handleApiError(result.error.status, `Error al eliminar: ${result.error.detail}`);
      return;
    }

    addToast({ message: "Venta eliminada", type: "success" });
    await fetchPage(page());
  };

  onMount(async () => {
    setPage(1);
    await fetchPage(1);
  });

  return (
    <>
      <div class={styles.container}>
        <div class={styles.toolbar}>
          <div class={styles.titleBlock}>
            <h1 class={styles.title}>Ventas</h1>
            <p class={styles.subtitle}>Historial y ajustes de ventas</p>
          </div>

          <div class={styles.toolbarActions}>
            <div class={styles.filterFieldSearch}>
              <label class={styles.label}>Buscar</label>
              <input
                type="text"
                class={styles.input}
                value={searchText()}
                placeholder="ID, usuario o método"
                onInput={(e) => setSearchText(e.currentTarget.value)}
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

            <button class={styles.btnPrimary} onClick={() => setSelectedSale(null)}>
              Nueva venta
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
            <For each={saleItems()}>
              {(item) => (
                <article class={styles.card} classList={{ [styles.disabledCard]: !item.matches }}>
                  <div class={styles.cardHeader}>
                    <div>
                      <h3 class={styles.cardTitle}>Venta #{item.sale.id}</h3>
                      <p class={styles.cardDate}>{formatDateTime(item.sale.sale_date)}</p>
                    </div>

                    <div class={styles.actions}>
                      <button class={styles.iconBtn} onClick={() => setSelectedSale(item.sale)}>
                        ✏️
                      </button>
                      <button class={styles.iconBtn} onClick={() => void handleDelete(item.sale)}>
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div class={styles.metaGrid}>
                    <div>
                      <span class={styles.metaLabel}>Usuario</span>
                      <span class={styles.metaValue}>{item.sale.username ?? "-"}</span>
                    </div>
                    <div>
                      <span class={styles.metaLabel}>Método</span>
                      <span class={styles.metaValue}>{methodNameById(item.sale.payment_method_id)}</span>
                    </div>
                    <div>
                      <span class={styles.metaLabel}>Productos</span>
                      <span class={styles.metaValue}>{item.sale.products.length}</span>
                    </div>
                    <div>
                      <span class={styles.metaLabel}>Total</span>
                      <span class={styles.totalValue}>S/ {item.sale.total_charged.toFixed(2)}</span>
                    </div>
                  </div>
                </article>
              )}
            </For>
          </div>

          <Show when={sales().length === 0}>
            <p class={styles.emptyState}>No se encontraron ventas</p>
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

      <Show when={selectedSale() !== undefined}>
        <VentaCU
          sale={selectedSale() ?? null}
          onRequestCreateProduct={(prefill) => {
            setCreateProductPrefill(prefill ?? {});
            setShowCreateProductModal(true);
          }}
          onClose={() => setSelectedSale(undefined)}
          onSaved={async () => {
            await fetchPage(page());
          }}
        />
      </Show>

      <Show when={showCreateProductModal()}>
        <ModCUProd
          product={null}
          defaultName={createProductPrefill().name}
          defaultBarcode={createProductPrefill().barcode}
          onClose={() => {
            setShowCreateProductModal(false);
            setCreateProductPrefill({});
          }}
        />
      </Show>
    </>
  );
};

export default Sales;
