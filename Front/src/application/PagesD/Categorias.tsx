import { For, Show, createSignal, type Component } from "solid-js";
import { useWebSocket } from "../context/web_socket";
import styles from "./Categorias.module.css";
import type { CategoriesRealTime } from "../../domain/categories";
import { ModCUCat } from "../components/Categories/ModCUCat";
import { deleteCategory } from "../../infrastructure/categories";
import { confirmWithOptions } from "../common/UI/Confirm/confirmStore";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../context/auth";
import { addToast } from "../common/UI/Toast/toastStore";
import { normalize } from "./utils";


const Categorias: Component = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { currentCategories } = useWebSocket();

    const [search, setSearch] = createSignal("");
    const [selectCategory, setSelectCategory] = createSignal<
        CategoriesRealTime | null | undefined
    >(undefined);
    const [deleteComment, setDeleteComment] = createSignal("");


    const matchesSearch = (cat: CategoriesRealTime, query: string) => {
        if (!query) return true;
        return (
            cat.name.toLowerCase().includes(query) ||
            cat.id.toString().includes(query)
        );
    };

    const categoryItems = () => {
        const query = normalize(search());

        return [...currentCategories()]
            .map((category) => ({
                category,
                matches: matchesSearch(category, query),
            }))
            .sort((a, b) => {
                if (a.matches !== b.matches) return a.matches ? -1 : 1;
                return a.category.name.localeCompare(b.category.name, "es", {
                    sensitivity: "base",
                });
            });
    };

    const handleEdit = (cat: CategoriesRealTime) => {
        setSelectCategory(cat);
    };

    const handleDelete = async (cat: CategoriesRealTime) => {
        setDeleteComment("");

        const result = await confirmWithOptions({
            title: "Atención",
            message: `¿Seguro de eliminar la categoría ${cat.name}?`,
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
            fn: async () => await deleteCategory(cat.id, deleteComment().trim() || undefined),
        });

        if (result === null) return;

        if (result?.error) {
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

        if (result?.data) {
            addToast({
                message: "Categoría eliminada",
                type: "success",
            });
        }
    };

    const handleNew = () => {
        setSelectCategory(null);
    };

    return (
        <>
            <div class={styles.container}>
                <div class={styles.header}>
                    <input
                        type="text"
                        placeholder="Buscar categorías..."
                        value={search()}
                        onInput={(e) => setSearch(e.currentTarget.value)}
                        class={styles.searchInput}
                    />
                    <button class={styles.btnPrimary} onClick={handleNew}>
                        Agregar categoría
                    </button>
                </div>

                <div class={styles.grid}>
                    <For each={categoryItems()}>
                        {(item) => (
                            <div
                                class={styles.card}
                                classList={{ [styles.disabledCard]: !item.matches }}
                            >
                                <div class={styles.cardContent}>
                                    <div class={styles.nameRow}>
                                        <span
                                            class={styles.swatch}
                                            style={{
                                                "background-color": item.category.color ?? "#ffffff",
                                            }}
                                        />
                                        <div class={styles.textGroup}>
                                            <span class={styles.name}>{item.category.name}</span>
                                            <span class={styles.meta}>
                                                {item.category.color ?? "#ffffff"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div class={styles.actions}>
                                    <button
                                        class={styles.btnEdit}
                                        onClick={() => handleEdit(item.category)}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        class={styles.btnDelete}
                                        onClick={() => handleDelete(item.category)}
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>

                <Show when={currentCategories().length === 0}>
                    <p class={styles.emptyState}>No se encontraron categorías</p>
                </Show>
            </div>

            <Show when={selectCategory() !== undefined}>
                <ModCUCat
                    category={selectCategory()}
                    onClose={() => setSelectCategory(undefined)}
                />
            </Show>
        </>
    );
};

export default Categorias;
