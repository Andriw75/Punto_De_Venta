import { For, Show, createSignal, type Component } from "solid-js";
import { useNavigate } from "@solidjs/router";

import { useAuth } from "../context/auth";
import { useWebSocket } from "../context/web_socket";
import { addToast } from "../common/UI/Toast/toastStore";
import { confirm } from "../common/UI/Confirm/confirmStore";
import { ModCUPaymentMethod } from "../components/PaymentMethods/ModCUPaymentMethod";

import type { PaymentMethodRealTime } from "../../domain/payment_methods";
import { deletePaymentMethod } from "../../infrastructure/payment_methods";
import { normalize } from "./utils";

import styles from "./PaymentMethods.module.css";

const PaymentMethods: Component = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentPaymentMethods } = useWebSocket();

  const [search, setSearch] = createSignal("");
  const [selectedMethod, setSelectedMethod] = createSignal<
    PaymentMethodRealTime | null | undefined
  >(undefined);

  const matchesSearch = (method: PaymentMethodRealTime, query: string) => {
    if (!query) return true;

    return (
      method.name.toLowerCase().includes(query) || method.id.toString().includes(query)
    );
  };

  const paymentMethodItems = () => {
    const query = normalize(search());

    return [...currentPaymentMethods()]
      .map((method) => ({
        method,
        matches: matchesSearch(method, query),
      }))
      .sort((a, b) => {
        if (a.matches !== b.matches) return a.matches ? -1 : 1;
        return a.method.name.localeCompare(b.method.name, "es", {
          sensitivity: "base",
        });
      });
  };

  const handleDelete = async (method: PaymentMethodRealTime) => {
    const result = await confirm(
      "Atención",
      `¿Seguro de eliminar el método de pago ${method.name}?`,
      async () => await deletePaymentMethod(method.id),
    );

    if (result === null) return;

    if (result.error) {
      if (result.error.status === 401) {
        await logout(false);
        navigate("/login");
        return;
      }

      addToast({
        message: `Error al eliminar: ${result.error.detail}`,
        type: "error",
      });
      return;
    }

    addToast({
      message: "Método de pago eliminado",
      type: "success",
    });
  };

  return (
    <>
      <div class={styles.container}>
        <div class={styles.header}>
          <input
            type="text"
            placeholder="Buscar métodos de pago..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            class={styles.searchInput}
          />
          <button class={styles.btnPrimary} onClick={() => setSelectedMethod(null)}>
            Agregar método
          </button>
        </div>

        <div class={styles.grid}>
          <For each={paymentMethodItems()}>
            {(item) => (
              <div class={styles.card} classList={{ [styles.disabledCard]: !item.matches }}>
                <div>
                  <div class={styles.name}>{item.method.name}</div>
                  <div class={styles.meta}>ID: {item.method.id}</div>
                </div>

                <div class={styles.actions}>
                  <button class={styles.btnEdit} onClick={() => setSelectedMethod(item.method)}>
                    ✏️
                  </button>
                  <button class={styles.btnDelete} onClick={() => void handleDelete(item.method)}>
                    🗑
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>

        <Show when={currentPaymentMethods().length === 0}>
          <p class={styles.emptyState}>No se encontraron métodos de pago</p>
        </Show>
      </div>

      <Show when={selectedMethod() !== undefined}>
        <ModCUPaymentMethod
          method={selectedMethod()}
          onClose={() => setSelectedMethod(undefined)}
        />
      </Show>
    </>
  );
};

export default PaymentMethods;
