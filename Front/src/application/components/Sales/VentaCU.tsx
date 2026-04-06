import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  Show,
  type Component,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import ModalCommon from "../../common/UI/ModalCommon";
import ProductList, { type ProductListItem } from "./ProductList";
import Cart, { type CartItem } from "./Cart";
import styles from "./VentaCU.module.css";
import { useWebSocket } from "../../context/web_socket";
import { useAuth } from "../../context/auth";
import { addToast } from "../../common/UI/Toast/toastStore";
import type { SaleCreate, SaleResponse, SaleUpdate } from "../../../domain/sales";
import { createSale, updateSale } from "../../../infrastructure/sales";
import { normalize } from "../../PagesD/utils";

type VentaCUProps = {
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onRequestCreateProduct: (prefill?: { name?: string; barcode?: string }) => void;
  sale: SaleResponse | null;
};

const toProductsSignature = (items: CartItem[]) =>
  [...items]
    .sort((a, b) => a.product_id - b.product_id)
    .map((item) => `${item.product_id}:${item.quantity}`)
    .join("|");

const VentaCU: Component<VentaCUProps> = (props) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentProducts, currentPaymentMethods } = useWebSocket();

  const [searchName, setSearchName] = createSignal("");
  const [searchCode, setSearchCode] = createSignal("");
  const [paymentMethodId, setPaymentMethodId] = createSignal<number | null>(null);
  const [cart, setCart] = createSignal<CartItem[]>([]);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isTotalUnlocked, setIsTotalUnlocked] = createSignal(false);
  const [restoreProducts, setRestoreProducts] = createSignal(false);
  const [totalText, setTotalText] = createSignal("0.00");
  const [comment, setComment] = createSignal("");

  const [initialSignature, setInitialSignature] = createSignal("");
  const [initialPaymentMethodId, setInitialPaymentMethodId] = createSignal<number | null>(null);
  const [initialTotal, setInitialTotal] = createSignal(0);
  const [initializedSaleKey, setInitializedSaleKey] = createSignal<string | null>(null);

  let codeInputRef: HTMLInputElement | undefined;

  const isCreate = createMemo(() => props.sale == null);
  const computedTotal = createMemo(() =>
    cart().reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
  );

  const paymentMethodName = createMemo(() => {
    const current = currentPaymentMethods().find((method) => method.id === paymentMethodId());
    return current?.name ?? "Método";
  });

  const productsChanged = createMemo(() => toProductsSignature(cart()) !== initialSignature());
  const paymentChanged = createMemo(() => paymentMethodId() !== initialPaymentMethodId());
  const parsedManualTotal = createMemo(() => Number(totalText()));

  const totalChanged = createMemo(() => {
    const total = parsedManualTotal();
    if (!Number.isFinite(total)) return true;
    return Math.abs(total - initialTotal()) > 0.00001;
  });

  const hasUpdateChanges = createMemo(() => {
    if (isCreate()) return false;
    return (
      productsChanged() ||
      paymentChanged() ||
      totalChanged() ||
      comment().trim().length > 0
    );
  });

  onMount(() => {
    setTimeout(() => codeInputRef?.focus(), 0);
  });

  const saleKey = createMemo(() => (props.sale ? `sale-${props.sale.id}` : "sale-new"));

  createEffect(() => {
    const key = saleKey();
    if (initializedSaleKey() === key) return;
    setInitializedSaleKey(key);

    const sale = props.sale;

    if (!sale) {
      setCart([]);
      setSearchName("");
      setSearchCode("");
      setComment("");
      setRestoreProducts(false);
      setIsTotalUnlocked(false);

      setPaymentMethodId(null);
      setInitialPaymentMethodId(null);
      setInitialTotal(0);
      setInitialSignature("");
      setTotalText("0.00");
      return;
    }

    const items: CartItem[] = sale.products.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      unit_price: item.unit_price,
      quantity: item.quantity,
    }));

    setCart(items);
    setSearchName("");
    setSearchCode("");
    setComment("");
    setRestoreProducts(false);
    setIsTotalUnlocked(false);
    setPaymentMethodId(sale.payment_method_id);
    setInitialPaymentMethodId(sale.payment_method_id);
    setInitialTotal(sale.total_charged);
    setInitialSignature(toProductsSignature(items));
    setTotalText(sale.total_charged.toFixed(2));
  });

  createEffect(() => {
    if (!isCreate()) return;
    if (paymentMethodId() != null) return;

    const defaultPayment = currentPaymentMethods()[0]?.id;
    if (defaultPayment == null) return;

    setPaymentMethodId(defaultPayment);
    setInitialPaymentMethodId(defaultPayment);
  });

  createEffect(() => {
    if (!isTotalUnlocked()) {
      setTotalText(computedTotal().toFixed(2));
    }
  });

  const orderedProducts = createMemo<ProductListItem[]>(() => {
    const queryName = normalize(searchName());
    const queryCode = normalize(searchCode());
    const all = currentProducts();

    const matches: ProductListItem[] = [];
    const rest: ProductListItem[] = [];

    for (const product of all) {
      const nameMatch = !queryName || normalize(product.name).includes(queryName);
      const codeMatch =
        !queryCode ||
        String(product.id).includes(queryCode) ||
        normalize(product.barcode ?? "").includes(queryCode);

      if (nameMatch && codeMatch) {
        matches.push({ ...product, disabled: false });
      } else {
        rest.push({ ...product, disabled: true });
      }
    }

    const sorter = (a: ProductListItem, b: ProductListItem) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" });

    return [...matches.sort(sorter), ...rest.sort(sorter)];
  });

  const addToCart = (product: ProductListItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (!existing) {
        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            unit_price: product.price,
            quantity: 1,
          },
        ];
      }

      return prev.map((item) =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity } : item,
      ),
    );
  };

  const clearFields = () => {
    batch(() => {
      setSearchName("");
      setSearchCode("");
    });
    setTimeout(() => codeInputRef?.focus(), 0);
  };

  const handleCodeEnter = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;

    const query = normalize(searchCode());
    if (!query) return;

    const product = currentProducts().find(
      (candidate) =>
        String(candidate.id) === query || normalize(candidate.barcode ?? "") === query,
    );

    if (!product) {
      props.onRequestCreateProduct({ barcode: searchCode().trim(), name: searchName().trim() });
      return;
    }

    addToCart(product);
    clearFields();
  };

  const handleNameEnter = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;

    const query = normalize(searchName());
    if (!query) return;

    const product = currentProducts().find((candidate) => normalize(candidate.name) === query);

    if (!product) {
      props.onRequestCreateProduct({ name: searchName().trim(), barcode: searchCode().trim() });
      return;
    }

    addToCart(product);
    clearFields();
  };

  const handleApiError = async (status: number, detail: string) => {
    if (status === 401) {
      await logout(false);
      navigate("/login");
      return;
    }
    addToast({ message: detail, type: "error" });
  };

  const handleSave = async () => {
    if (isSaving()) return;

    const methodId = paymentMethodId();
    if (!methodId) {
      addToast({ message: "Selecciona un método de pago", type: "error" });
      return;
    }

    if (cart().length === 0) {
      addToast({ message: "Agrega al menos un producto", type: "error" });
      return;
    }

    const finalTotal = parsedManualTotal();
    if (!Number.isFinite(finalTotal) || finalTotal <= 0) {
      addToast({ message: "El total debe ser mayor a 0", type: "error" });
      return;
    }

    if (!isCreate() && productsChanged() && !restoreProducts()) {
      addToast({
        message: "Activa ♻️ restaurar productos para cambiar ítems",
        type: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isCreate()) {
        const payload: SaleCreate = {
          payment_method_id: methodId,
          total_charged: finalTotal,
          products: cart().map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        };

        const result = await createSale(payload);
        if (result.error) {
          await handleApiError(result.error.status, result.error.detail);
          return;
        }

        addToast({ message: "Venta registrada", type: "success" });
        await props.onSaved();
        props.onClose();
        return;
      }

      if (!hasUpdateChanges()) {
        props.onClose();
        return;
      }

      const payload: SaleUpdate = {};

      if (paymentChanged()) payload.payment_method_id = methodId;
      if (totalChanged()) payload.total_charged = finalTotal;
      if (productsChanged()) {
        payload.products = cart().map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }));
      }

      const commentValue = comment().trim();
      if (commentValue) payload.comentario = commentValue;

      const result = await updateSale(props.sale!.id, payload, restoreProducts());
      if (result.error) {
        await handleApiError(result.error.status, result.error.detail);
        return;
      }

      addToast({ message: "Venta actualizada", type: "success" });
      await props.onSaved();
      props.onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalCommon onClose={props.onClose} width="95vw">
      <div class={styles.container}>
        <div class={styles.header}>
          <h2>{isCreate() ? "Nueva venta" : `Editar venta #${props.sale!.id}`}</h2>
        </div>

        <div class={styles.layout}>
          <div class={styles.leftColumn}>
            <ProductList products={orderedProducts()} onSelect={addToCart} />
          </div>

          <div class={styles.rightColumn}>
            <div class={styles.searchRow}>
              <div class={styles.searchItem}>
                <label class={styles.label}>Buscar por nombre</label>
                <input
                  class={styles.input}
                  value={searchName()}
                  placeholder="Nombre..."
                  onInput={(e) => setSearchName(e.currentTarget.value)}
                  onKeyDown={handleNameEnter}
                />
              </div>

              <div class={styles.searchItem}>
                <label class={styles.label}>Código o ID</label>
                <input
                  ref={codeInputRef}
                  class={`${styles.input} ${styles.codeInput}`}
                  value={searchCode()}
                  placeholder="Escanea o escribe..."
                  onInput={(e) => setSearchCode(e.currentTarget.value)}
                  onKeyDown={handleCodeEnter}
                />
              </div>

              <div class={styles.searchItem}>
                <label class={styles.label}>Acciones de búsqueda</label>
                <div class={styles.searchActions}>
                  <button class={styles.toggleBtn} onClick={clearFields}>
                    🧹 Limpiar
                  </button>
                  <button
                    class={styles.toggleBtn}
                    onClick={() =>
                      props.onRequestCreateProduct({
                        name: searchName().trim(),
                        barcode: searchCode().trim(),
                      })
                    }
                  >
                    ➕ Crear producto
                  </button>
                </div>
              </div>
            </div>

            <Cart
              items={cart()}
              editable={isCreate() || restoreProducts()}
              onRemoveItem={removeFromCart}
              onUpdateQuantity={updateQuantity}
            />

            <div class={styles.saleDataRow}>
              <div class={styles.searchItem}>
                <label class={styles.label}>Método de pago</label>
                <select
                  class={styles.select}
                  value={paymentMethodId() ?? ""}
                  onChange={(e) => setPaymentMethodId(Number(e.currentTarget.value))}
                >
                  <Show when={currentPaymentMethods().length > 0} fallback={<option value="">Sin métodos</option>}>
                    {currentPaymentMethods().map((method) => (
                      <option value={method.id}>{method.name}</option>
                    ))}
                  </Show>
                </select>
              </div>

              <div class={styles.searchItem}>
                <label class={styles.label}>Comentario (opcional)</label>
                <input
                  class={styles.input}
                  value={comment()}
                  maxLength={180}
                  onInput={(e) => setComment(e.currentTarget.value)}
                  placeholder="Motivo de ajuste..."
                />
              </div>
            </div>

            <div class={styles.actions}>
              <div class={styles.summary}>
                <span>Total ({paymentMethodName()}):</span>
                <input
                  class={isTotalUnlocked() ? styles.totalInputEditable : styles.totalInput}
                  value={totalText()}
                  onInput={(e) => setTotalText(e.currentTarget.value)}
                  disabled={!isTotalUnlocked()}
                />
              </div>

              <div class={styles.toggleRow}>
                <button
                  class={styles.toggleBtn}
                  classList={{ [styles.toggleActive]: isTotalUnlocked() }}
                  onClick={() => setIsTotalUnlocked((prev) => !prev)}
                >
                  {isTotalUnlocked() ? "🔓 Total manual" : "🔒 Total automático"}
                </button>

                <Show when={!isCreate()}>
                  <button
                    class={styles.toggleBtn}
                    classList={{ [styles.toggleActive]: restoreProducts() }}
                    onClick={() => setRestoreProducts((prev) => !prev)}
                  >
                    {restoreProducts() ? "♻️ Restaurar stock: ON" : "♻️ Restaurar stock: OFF"}
                  </button>
                </Show>
              </div>

              <button
                class={styles.sendButton}
                onClick={handleSave}
                disabled={isSaving() || cart().length === 0 || (!isCreate() && !hasUpdateChanges())}
              >
                {isSaving()
                  ? "Guardando..."
                  : isCreate()
                    ? "Finalizar venta"
                    : "Guardar cambios"}
              </button>
            </div>

            <div class={styles.helper}>
              Recalculado por productos: S/ {computedTotal().toFixed(2)}
              <Show when={!isCreate()}>
                {` | Total histórico: S/ ${initialTotal().toFixed(2)}`}
              </Show>
            </div>
          </div>
        </div>
      </div>
    </ModalCommon>
  );
};

export default VentaCU;
