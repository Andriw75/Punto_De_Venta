import { For, Show, type Component } from "solid-js";
import styles from "./Cart.module.css";

export type CartItem = {
  product_id: number;
  name: string;
  unit_price: number;
  quantity: number;
};

type CartProps = {
  items: CartItem[];
  editable: boolean;
  onRemoveItem: (productId: number) => void;
  onUpdateQuantity: (productId: number, quantity: number) => void;
};

const Cart: Component<CartProps> = (props) => {
  const handleQuantityChange = (productId: number, value: string) => {
    const quantity = Number.parseInt(value, 10);
    if (!Number.isNaN(quantity) && quantity >= 1) {
      props.onUpdateQuantity(productId, quantity);
    }
  };

  return (
    <div class={styles.cart}>
      <div class={styles.cartHeader}>
        <h3>Productos en la venta</h3>
        <div class={styles.itemCount}>{props.items.length} items</div>
      </div>

      <div class={styles.cartItems}>
        <For each={props.items}>
          {(item) => (
            <div class={styles.cartItem}>
              <div class={styles.itemInfo}>
                <div class={styles.itemName}>{item.name}</div>
                <div class={styles.itemMeta}>
                  <span class={styles.itemCode}>#{item.product_id}</span>
                  <span class={styles.itemPrice}>S/ {item.unit_price.toFixed(2)}</span>
                </div>
              </div>

              <div class={styles.itemControls}>
                <div class={styles.quantityControl}>
                  <button
                    class={styles.quantityButton}
                    onClick={() => props.onUpdateQuantity(item.product_id, item.quantity - 1)}
                    disabled={!props.editable || item.quantity <= 1}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    class={styles.quantityInput}
                    onInput={(e) => handleQuantityChange(item.product_id, e.currentTarget.value)}
                    disabled={!props.editable}
                  />
                  <button
                    class={styles.quantityButton}
                    onClick={() => props.onUpdateQuantity(item.product_id, item.quantity + 1)}
                    disabled={!props.editable}
                  >
                    +
                  </button>
                </div>

                <button
                  class={styles.removeButton}
                  onClick={() => props.onRemoveItem(item.product_id)}
                  disabled={!props.editable}
                >
                  Eliminar
                </button>
              </div>

              <div class={styles.itemSubtotal}>S/ {(item.unit_price * item.quantity).toFixed(2)}</div>
            </div>
          )}
        </For>

        <Show when={props.items.length === 0}>
          <div class={styles.emptyCart}>No hay productos en la venta</div>
        </Show>
      </div>
    </div>
  );
};

export default Cart;
