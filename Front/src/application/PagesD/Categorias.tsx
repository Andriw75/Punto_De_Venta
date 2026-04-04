import { For, Show, createSignal, type Component } from "solid-js";
import { useWebSocket } from "../context/web_socket";
import styles from "./Categorias.module.css";
import type { CategoriesRealTime } from "../../domain/categories";
import { ModCUCat } from "../components/Categories/ModCUCat";
import { deleteCategory } from "../../infrastructure/categories";
import { confirm } from "../common/UI/Confirm/confirmStore";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../context/auth";
import { addToast } from "../common/UI/Toast/toastStore";

const Categorias: Component = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { currentCategories } = useWebSocket();
    const [search, setSearch] = createSignal("");
    const [selectCategory, setSelectCategory] = createSignal<CategoriesRealTime | null | undefined>(undefined);

    const filteredCategories = () =>
        currentCategories().filter((cat) =>
            cat.name.toLowerCase().includes(search().toLowerCase()) ||
            cat.id.toString().includes(search())
        );

    const handleEdit = (cat: CategoriesRealTime) => {
        setSelectCategory(cat);
    };

    const handleDelete = async (cat: CategoriesRealTime) => {
        const result = await confirm(
            "Atención", `¿Seguro de eliminar la categoría ${cat.name}?`, async () => await deleteCategory(cat.id)
        )

        if (result === null) return;

        if (result?.error) {
            if (result?.error.status === 401) {
                await logout(false);
                navigate(`/login`);
            }

            addToast({
                message: `Error al eliminar: ${result.error.detail}`,
                type: "error",
            });
        } else if (result?.data) {
            addToast({
                message: "Rifa eliminada",
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
                    <For each={filteredCategories()}>
                        {(cat) => (
                            <div class={styles.card}>
                                <div class={styles.cardContent}>
                                    <span class={styles.name}>{cat.name}</span>
                                </div>

                                <div class={styles.actions}>
                                    <button
                                        class={styles.btnEdit}
                                        onClick={() => handleEdit(cat)}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        class={styles.btnDelete}
                                        onClick={() => handleDelete(cat)}
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
                <Show when={filteredCategories().length === 0}>
                    <p>No se encontraron categorías</p>
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