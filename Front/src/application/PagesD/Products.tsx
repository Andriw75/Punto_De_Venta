import { type Component, createSignal, For } from "solid-js";
import { useWebSocket } from "../context/web_socket";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../context/auth";
import stylesC from "./Categorias.module.css";
import styles from "./Products.module.css";
import type { ProductoRealTime } from "../../domain/products";
import { normalize } from "./utils";

const Products: Component = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { currentCategories, currentProducts } = useWebSocket();

    const [search, setSearch] = createSignal("");

    const [selectProduct, setSelectProduct] = createSignal<
        ProductoRealTime | null | undefined
    >(undefined);

    const handleNew = () => {
        setSelectProduct(null);
    };

    /************************************************************************************/
    const matchesSearch = (prod: ProductoRealTime, query: string) => {
        if (!query) return true;

        return (
            prod.name.toLowerCase().includes(query) ||
            prod.id.toString().includes(query) ||
            prod.barcode?.toString().includes(query)
        );
    };

    const productsItems = () => {
        const query = normalize(search());

        return [...currentProducts()]
            .map((prod) => ({
                prod,
                matches: matchesSearch(prod, query),
            }))
            .sort((a, b) => {
                if (a.matches !== b.matches) return a.matches ? -1 : 1;

                return a.prod.name.localeCompare(b.prod.name, "es", {
                    sensitivity: "base",
                });
            });
    };

    const getCategoryName = (categoryId?: number) => {
        if (categoryId == null) return "Sin Categoría";

        const category = currentCategories().find((cat) => cat.id === categoryId);
        return category?.name ?? "Sin Categoría";
    };

    return (
        <>
            <div class={stylesC.container}>
                <div class={stylesC.header}>
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        value={search()}
                        onInput={(e) => setSearch(e.currentTarget.value)}
                        class={stylesC.searchInput}
                    />
                    <button class={stylesC.btnPrimary} onClick={handleNew}>
                        Agregar producto
                    </button>
                </div>

                <div class={styles.grid}>
                    <For each={productsItems()}>
                        {(item) => (
                            <div
                                class={styles.card}
                                classList={{ [stylesC.disabledCard]: !item.matches }}
                            >
                                <div class={styles.cardTop}>
                                    <div class={styles.titleBlock}>
                                        <span class={styles.name}>{item.prod.name}</span>
                                        <span class={styles.category}>
                                            {getCategoryName(item.prod.category_id)}
                                        </span>
                                    </div>

                                    <div class={styles.stockBadge}>
                                        {item.prod.stock} en stock
                                    </div>
                                </div>

                                <div class={styles.cardBody}>
                                    <div class={styles.metaRow}>
                                        <span class={styles.metaItem}>
                                            {item.prod.barcode ?? "Sin código"}
                                        </span>
                                        <span class={styles.metaItem}>
                                            S/ {item.prod.price.toFixed(2)}
                                        </span>
                                    </div>

                                    <div class={styles.description}>
                                        {item.prod.description ?? "Sin descripción"}
                                    </div>
                                </div>

                                <div class={styles.actions}>
                                    <button
                                        class={stylesC.btnEdit}
                                        onClick={() => console.log("Editar producto:", item.prod)}
                                    >
                                        ✏️
                                    </button>

                                    <button
                                        class={stylesC.btnDelete}
                                        onClick={() => console.log("Eliminar producto:", item.prod)}
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>

            </div>

        </>

    );
};

export default Products;