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
import KV, { type KVItem, type KVValidationErrors } from "../../common/components/KV";
import styles from "./ModCUProd.module.css";


interface ModCUProdProps {
    onClose: () => void;
    product?: ProductoRealTime | null;
}

type ProductEditSnapshot = {
    name: string;
    description: string;
    barcode: string;
    priceText: string;
    stockText: string;
    categoryIdText: string;
    comentario: string;
    metadataItems: KVItem[];
};

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
    const [metadataItems, setMetadataItems] = createSignal<KVItem[]>([]);
    const [metadataValid, setMetadataValid] = createSignal(true);
    const [isLoading, setIsLoading] = createSignal(false);
    const [previewingOriginal, setPreviewingOriginal] = createSignal(false);
    const [hoverSnapshot, setHoverSnapshot] = createSignal<ProductEditSnapshot | null>(null);

    const [initialName, setInitialName] = createSignal("");
    const [initialDescription, setInitialDescription] = createSignal<string | null>(null);
    const [initialBarcode, setInitialBarcode] = createSignal<string | null>(null);
    const [initialPrice, setInitialPrice] = createSignal(0);
    const [initialStock, setInitialStock] = createSignal(0);
    const [initialCategoryId, setInitialCategoryId] = createSignal<number | null>(null);
    const [initialMetadataItems, setInitialMetadataItems] = createSignal<KVItem[]>([]);

    const isCreate = createMemo(() => props.product == null);

    const copyKVItems = (items: KVItem[]) => items.map((item) => ({ ...item }));
    const createRowId = () =>
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;

    const metadataToItems = (metadata?: Record<string, any> | null): KVItem[] => {
        if (!metadata) return [];

        return Object.entries(metadata).map(([key, value]) => ({
            id: createRowId(),
            key,
            value: value == null ? "" : String(value),
        }));
    };

    const metadataItemsToObject = (items: KVItem[]): Record<string, string> | null => {
        const result: Record<string, string> = {};

        for (const item of items) {
            const key = item.key.trim();
            if (!key) continue;
            result[key] = item.value;
        }

        return Object.keys(result).length > 0 ? result : null;
    };

    const metadataSignature = (metadata: Record<string, any> | null | undefined) => {
        if (!metadata) return "";

        const normalized: Record<string, string> = {};
        for (const key of Object.keys(metadata).sort()) {
            normalized[key] = metadata[key] == null ? "" : String(metadata[key]);
        }
        return JSON.stringify(normalized);
    };

    const metadataChanged = createMemo(() => {
        if (isCreate()) return false;
        return (
            metadataSignature(metadataItemsToObject(metadataItems())) !==
            metadataSignature(metadataItemsToObject(initialMetadataItems()))
        );
    });

    const hasUpdateChanges = createMemo(() => {
        if (isCreate()) return false;

        const descriptionValue = normalizeNullableText(description());
        const barcodeValue = normalizeNullableText(barcode());
        const parsedCategory = parseCategory(categoryIdText());
        const parsedStock = parseStock(stockText());
        const parsedPrice = parsePrice(priceText());

        if (parsedCategory === undefined || parsedStock === undefined || parsedPrice === undefined) {
            return true;
        }

        return (
            name().trim() !== initialName() ||
            descriptionValue !== initialDescription() ||
            barcodeValue !== initialBarcode() ||
            parsedPrice !== initialPrice() ||
            parsedStock !== initialStock() ||
            parsedCategory !== initialCategoryId() ||
            comentario().trim().length > 0 ||
            metadataChanged()
        );
    });

    const applyInitialValues = () => {
        setName(initialName());
        setDescription(initialDescription() ?? "");
        setBarcode(initialBarcode() ?? "");
        setPriceText(String(initialPrice()));
        setStockText(String(initialStock()));
        setCategoryIdText(initialCategoryId() == null ? "" : String(initialCategoryId()));
        setComentario("");
        setMetadataItems(copyKVItems(initialMetadataItems()));
    };

    const resetToInitial = () => {
        applyInitialValues();
        setPreviewingOriginal(false);
        setHoverSnapshot(null);
    };

    const setCurrentFromSnapshot = (snapshot: ProductEditSnapshot) => {
        setName(snapshot.name);
        setDescription(snapshot.description);
        setBarcode(snapshot.barcode);
        setPriceText(snapshot.priceText);
        setStockText(snapshot.stockText);
        setCategoryIdText(snapshot.categoryIdText);
        setComentario(snapshot.comentario);
        setMetadataItems(copyKVItems(snapshot.metadataItems));
    };

    const previewOriginalOnHover = () => {
        if (isCreate() || !hasUpdateChanges() || isLoading() || previewingOriginal()) return;

        setHoverSnapshot({
            name: name(),
            description: description(),
            barcode: barcode(),
            priceText: priceText(),
            stockText: stockText(),
            categoryIdText: categoryIdText(),
            comentario: comentario(),
            metadataItems: copyKVItems(metadataItems()),
        });

        applyInitialValues();
        setPreviewingOriginal(true);
    };

    const restoreEditedOnLeave = () => {
        if (!previewingOriginal()) return;
        const snapshot = hoverSnapshot();
        if (!snapshot) return;

        setCurrentFromSnapshot(snapshot);
        setPreviewingOriginal(false);
        setHoverSnapshot(null);
    };

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
            setMetadataItems([]);

            setInitialName("");
            setInitialDescription(null);
            setInitialBarcode(null);
            setInitialPrice(0);
            setInitialStock(0);
            setInitialCategoryId(null);
            setInitialMetadataItems([]);
            setPreviewingOriginal(false);
            setHoverSnapshot(null);
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
        const metadata = metadataToItems(product.metadata ?? null);
        setMetadataItems(copyKVItems(metadata));

        setInitialName(product.name);
        setInitialDescription(product.description ?? null);
        setInitialBarcode(product.barcode ?? null);
        setInitialPrice(product.price);
        setInitialStock(product.stock);
        setInitialCategoryId(product.category_id ?? null);
        setInitialMetadataItems(copyKVItems(metadata));
        setPreviewingOriginal(false);
        setHoverSnapshot(null);
    });

    function normalizeNullableText(value: string) {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
    }

    function parseCategory(raw: string): number | null | undefined {
        if (raw === "") return null;
        const numeric = Number(raw);
        if (!Number.isInteger(numeric) || numeric <= 0) {
            return undefined;
        }
        return numeric;
    }

    function parseStock(raw: string): number | undefined {
        const numeric = Number(raw);
        if (!Number.isInteger(numeric) || numeric < 0) {
            return undefined;
        }
        return numeric;
    }

    function parsePrice(raw: string): number | undefined {
        const numeric = Number(raw);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return undefined;
        }
        return numeric;
    }

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
        const metadataValue = metadataItemsToObject(metadataItems());

        if (!metadataValid()) {
            addToast({ message: "Corrige la metadata antes de guardar", type: "error" });
            return;
        }

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
                    metadata: metadataValue,
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
            if (metadataChanged()) payload.metadata = metadataValue;

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
                        classList={{ [styles.changedField]: !isCreate() && name().trim() !== initialName() }}
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
                            classList={{ [styles.changedField]: !isCreate() && parsePrice(priceText()) !== initialPrice() }}
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
                            classList={{ [styles.changedField]: !isCreate() && parseStock(stockText()) !== initialStock() }}
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
                        classList={{ [styles.changedField]: !isCreate() && parseCategory(categoryIdText()) !== initialCategoryId() }}
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
                        classList={{ [styles.changedField]: !isCreate() && normalizeNullableText(barcode()) !== initialBarcode() }}
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
                        classList={{ [styles.changedField]: !isCreate() && normalizeNullableText(description()) !== initialDescription() }}
                        maxLength={500}
                        disabled={isLoading()}
                    />
                </div>

                <div class={styles.field}>
                    <label class={styles.label}>Datos adicionales para cliente</label>
                    <KV
                        items={metadataItems()}
                        onChange={setMetadataItems}
                        onValidityChange={setMetadataValid}
                        disabled={isLoading()}
                        classList={{ [styles.changedBlock]: !isCreate() && metadataChanged() }}
                        validate={(item, index, items): KVValidationErrors | null => {
                            const key = item.key.trim();
                            const value = item.value;
                            const errors: KVValidationErrors = {};

                            if (key.length === 0 && value.trim().length > 0) {
                                errors.key = "La clave es obligatoria";
                            }

                            if (key.length > 0) {
                                const duplicates = items.filter(
                                    (entry, idx) => idx !== index && entry.key.trim().toLowerCase() === key.toLowerCase(),
                                );
                                if (duplicates.length > 0) {
                                    errors.key = "La clave no puede repetirse";
                                }
                            }

                            return errors.key || errors.value ? errors : null;
                        }}
                    />
                </div>

                {!isCreate() && (
                    <div class={styles.field}>
                        <label class={styles.label}>Comentario de cambio (opcional)</label>
                        <textarea
                            value={comentario()}
                            onInput={(e) => setComentario(e.currentTarget.value)}
                            class={styles.textarea}
                            classList={{ [styles.changedField]: comentario().trim().length > 0 }}
                            maxLength={200}
                            disabled={isLoading()}
                        />
                    </div>
                )}

                {isCreate() ? (
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
                ) : (
                    <div class={styles.buttonsUpdate}>
                        <button
                            class={styles.btnCancel}
                            onClick={props.onClose}
                            disabled={isLoading()}
                        >
                            Cancelar
                        </button>

                        <button
                            class={styles.btnPreview}
                            classList={{ [styles.btnPreviewActive]: hasUpdateChanges() || previewingOriginal() }}
                            disabled={isLoading() || (!hasUpdateChanges() && !previewingOriginal())}
                            onMouseEnter={previewOriginalOnHover}
                            onMouseLeave={restoreEditedOnLeave}
                            onClick={resetToInitial}
                        >
                            {previewingOriginal() ? "Restaurar Originales" : "Ver cambios"}
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
                                "Actualizar"
                            )}
                        </button>
                    </div>
                )}
            </div>
        </ModalCommon>
    );
};
