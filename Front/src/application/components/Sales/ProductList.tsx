import { For, type Component } from "solid-js";
import type { ProductoRealTime } from "../../../domain/products";
import styles from "./VentaCU.module.css";

export type ProductListItem = ProductoRealTime & {
  disabled?: boolean;
};

type ProductListProps = {
  products: ProductListItem[];
  onSelect: (product: ProductListItem) => void;
};

const ProductList: Component<ProductListProps> = (props) => {
  return (
    <div class={styles.productListWrap}>
      <div class={styles.productListHeader}>
        <strong>Productos</strong>
      </div>
      <div class={styles.productListScroll}>
        <For each={props.products}>
          {(product) => (
            <div
              class={styles.productRow}
              classList={{ [styles.disabled]: !!product.disabled }}
              onClick={() => !product.disabled && props.onSelect(product)}
              role="button"
              tabindex={product.disabled ? -1 : 0}
            >
              <div class={styles.productMain}>
                <div class={styles.productName}>{product.name}</div>
                <div class={styles.productMeta}>
                  #{product.id} | {product.barcode ?? "Sin código"}
                </div>
              </div>
              <div class={styles.productRight}>
                <div class={styles.price}>S/ {product.price.toFixed(2)}</div>
                <div class={styles.stock}>Stock: {product.stock}</div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default ProductList;
