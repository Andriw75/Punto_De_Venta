import { type Component, createEffect, createMemo, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import ModalCommon from "../../common/UI/ModalCommon";
import { useAuth } from "../../context/auth";
import { useWebSocket } from "../../context/web_socket";
import { addToast } from "../../common/UI/Toast/toastStore";
import LoadingLoop from "../../common/IconSvg/LoadingLoop";
import type { ProductoCreate, ProductoRealTime, ProductoUpdate } from "../../../domain/products";
import { createProduct, updateProduct } from "../../../infrastructure/products";
import { cleanUndefined } from "../../../infrastructure/utils";
import styles from "./ModCUProd.module.css";


interface ModCUProdProps {
    onClose: () => void;
    product?: ProductoRealTime | null;
}

export const ModCUProd: Component<ModCUProdProps> = (props) => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { currentCategories } = useWebSocket();

    const [name, setName] = createSignal("");
    const [description, setDescription] = createSignal("");
    const [barcode, setBarcode] = createSignal("");
    const [priceText, setPriceText] = createSignal("");
    const [stockText, setStockText] = createSignal("0");
    const [categoryIdText, setCategoryIdText] = createSignal("");
    const [comentario, setComentario] = createSignal("");
    const [isLoading, setIsLoading] = createSignal(false);

    const [initialName, setInitialName] = createSignal("");
    const [initialDescription, setInitialDescription] = createSignal<string | null>(null);
    const [initialBarcode, setInitialBarcode] = createSignal<string | null>(null);
    const [initialPrice, setInitialPrice] = createSignal(0);
    const [initialStock, setInitialStock] = createSignal(0);
    const [initialCategoryId, setInitialCategoryId] = createSignal<number | null>(null);

    const isCreate = createMemo(() => props.product == null);

    createEffect(() => {
        const product = props.product;

        if (!product) {
            setName("");
            setDescription("");
            setBarcode("");
            setPriceText("");
            setStockText("0");
            setCategoryIdText("");
            setComentario("");

            setInitialName("");
            setInitialDescription(null);
            setInitialBarcode(null);
            setInitialPrice(0);
            setInitialStock(0);
            setInitialCategoryId(null);
            return;
        }

        const currentDescription = product.description ?? "";
        const currentBarcode = product.barcode ?? "";
        const currentCategory = product.category_id == null ? "" : String(product.category_id);

        setName(product.name);
        setDescription(currentDescription);
        setBarcode(currentBarcode);
        setPriceText(String(product.price));
        setStockText(String(product.stock));
        setCategoryIdText(currentCategory);
        setComentario("");

        setInitialName(product.name);
        setInitialDescription(product.description ?? null);
        setInitialBarcode(product.barcode ?? null);
        setInitialPrice(product.price);
        setInitialStock(product.stock);
        setInitialCategoryId(product.category_id ?? null);
    });

    const normalizeNullableText = (value: string) => {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
    };

    const parseCategory = (raw: string): number | null | undefined => {
        if (raw === "") return null;
        const numeric = Number(raw);
        if (!Number.isInteger(numeric) || numeric <= 0) {
            return undefined;
        }
        return numeric;
    };

    const parseStock = (raw: string): number | undefined => {
        const numeric = Number(raw);
        if (!Number.isInteger(numeric) || numeric < 0) {
            return undefined;
        }
        return numeric;
    };

    const parsePrice = (raw: string): number | undefined => {
        const numeric = Number(raw);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return undefined;
        }
        return numeric;
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
        if (isLoading()) return;

        const currentName = name().trim();
        if (!currentName) {
            addToast({ message: "El nombre es obligatorio", type: "error" });
            return;
        }

        const stock = parseStock(stockText());
        if (stock === undefined) {
            addToast({ message: "El stock debe ser un entero mayor o igual a 0", type: "error" });
            return;
        }

        const price = parsePrice(priceText());
        if (price === undefined) {
            addToast({ message: "El precio debe ser mayor a 0", type: "error" });
            return;
        }

        const categoryId = parseCategory(categoryIdText());
        if (categoryId === undefined) {
            addToast({ message: "Categoría inválida", type: "error" });
            return;
        }

        const descriptionValue = normalizeNullableText(description());
        const barcodeValue = normalizeNullableText(barcode());

        setIsLoading(true);

        try {
            if (isCreate()) {
                const payload: ProductoCreate = {
                    name: currentName,
                    stock,
                    price,
                    description: descriptionValue,
                    barcode: barcodeValue,
                    category_id: categoryId,
                };

                const result = await createProduct(payload);
                if (result.error) {
                    await handleApiError(result.error.status, result.error.detail);
                    return;
                }

                addToast({ message: "Producto creado correctamente", type: "success" });
                props.onClose();
                return;
            }

            const payload: ProductoUpdate = {};

            if (currentName !== initialName()) payload.name = currentName;
            if (descriptionValue !== initialDescription()) payload.description = descriptionValue;
            if (barcodeValue !== initialBarcode()) payload.barcode = barcodeValue;
            if (price !== initialPrice()) payload.price = price;
            if (stock !== initialStock()) payload.stock = stock;
            if (categoryId !== initialCategoryId()) payload.category_id = categoryId;

            const comentarioValue = normalizeNullableText(comentario());
            if (comentarioValue) payload.comentario = comentarioValue;

            const data = cleanUndefined(payload);
            if (Object.keys(data).length === 0) {
                props.onClose();
                return;
            }

            const result = await updateProduct(props.product!.id, data);
            if (result.error) {
                await handleApiError(result.error.status, result.error.detail);
                return;
            }

            addToast({ message: "Producto actualizado correctamente", type: "success" });
            props.onClose();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalCommon onClose={props.onClose} width="460px">
            <div class={styles.container} classList={{ [styles.loading]: isLoading() }}>
                <div class={styles.header}>
                    <h3 class={styles.title}>{isCreate() ? "Nuevo producto" : "Editar producto"}</h3>
                </div>

                <div class={styles.field}>
                    <label class={styles.label}>Nombre</label>
                    <input
                        type="text"
                        value={name()}
                        onInput={(e) => setName(e.currentTarget.value)}
                        class={styles.input}
                        maxLength={120}
                        disabled={isLoading()}
                    />
                </div>

                <div class={styles.row}>
                    <div class={styles.field}>
                        <label class={styles.label}>Precio</label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={priceText()}
                            onInput={(e) => setPriceText(e.currentTarget.value)}
                            class={styles.input}
                            disabled={isLoading()}
                        />
                    </div>

                    <div class={styles.field}>
                        <label class={styles.label}>Stock</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={stockText()}
                            onInput={(e) => setStockText(e.currentTarget.value)}
                            class={styles.input}
                            disabled={isLoading()}
                        />
                    </div>
                </div>

                <div class={styles.field}>
                    <label class={styles.label}>Categoría</label>
                    <select
                        value={categoryIdText()}
                        onChange={(e) => setCategoryIdText(e.currentTarget.value)}
                        class={styles.input}
                        disabled={isLoading()}
                    >
                        <option value="">Sin categoría</option>
                        {currentCategories().map((cat) => (
                            <option value={String(cat.id)}>{cat.name}</option>
                        ))}
                    </select>
                </div>

                <div class={styles.field}>
                    <label class={styles.label}>Código de barras (opcional)</label>
                    <input
                        type="text"
                        value={barcode()}
                        onInput={(e) => setBarcode(e.currentTarget.value)}
                        class={styles.input}
                        maxLength={100}
                        disabled={isLoading()}
                    />
                </div>

                <div class={styles.field}>
                    <label class={styles.label}>Descripción (opcional)</label>
                    <textarea
                        value={description()}
                        onInput={(e) => setDescription(e.currentTarget.value)}
                        class={styles.textarea}
                        maxLength={500}
                        disabled={isLoading()}
                    />
                </div>

                {!isCreate() && (
                    <div class={styles.field}>
                        <label class={styles.label}>Comentario de cambio (opcional)</label>
                        <textarea
                            value={comentario()}
                            onInput={(e) => setComentario(e.currentTarget.value)}
                            class={styles.textarea}
                            maxLength={200}
                            disabled={isLoading()}
                        />
                    </div>
                )}

                <div class={styles.buttons}>
                    <button
                        class={styles.btnCancel}
                        onClick={props.onClose}
                        disabled={isLoading()}
                    >
                        Cancelar
                    </button>

                    <button
                        class={styles.btnPrimary}
                        onClick={handleSave}
                        disabled={isLoading()}
                    >
                        {isLoading() ? (
                            <span class={styles.loadingContent}>
                                <LoadingLoop />
                                Guardando...
                            </span>
                        ) : (
                            "Guardar"
                        )}
                    </button>
                </div>
            </div>
        </ModalCommon>
    );
};
