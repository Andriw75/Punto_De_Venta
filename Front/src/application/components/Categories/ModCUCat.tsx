import { type Component, createEffect, createSignal } from "solid-js";
import ModalCommon from "../../common/UI/ModalCommon";
import type {
    CategoriesRealTime,
    CategoryCreate,
    CategoryUpdate,
} from "../../../domain/categories";
import { createCategory, updateCategory } from "../../../infrastructure/categories";
import { cleanUndefined } from "../../../infrastructure/utils";
import styles from "./ModCUCat.module.css";
import { addToast } from "../../common/UI/Toast/toastStore";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../../context/auth";
import LoadingLoop from "../../common/IconSvg/LoadingLoop";

interface ModCUCatProps {
    onClose: () => void;
    category?: CategoriesRealTime | null;
}

type CategoryEditSnapshot = {
    name: string;
    color: string;
    comentario: string;
};

export const ModCUCat: Component<ModCUCatProps> = (props) => {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const [name, setName] = createSignal("");
    const [color, setColor] = createSignal("#ffffff");
    const [comentario, setComentario] = createSignal("");
    const [isLoading, setIsLoading] = createSignal(false);
    const [previewingOriginal, setPreviewingOriginal] = createSignal(false);
    const [hoverSnapshot, setHoverSnapshot] = createSignal<CategoryEditSnapshot | null>(null);

    const [initialName, setInitialName] = createSignal("");
    const [initialColor, setInitialColor] = createSignal("#ffffff");

    const isCreate = () => props.category == null;

    const hasUpdateChanges = () => {
        if (isCreate()) return false;
        return (
            name().trim() !== initialName() ||
            color() !== initialColor() ||
            comentario().trim().length > 0
        );
    };

    const applyInitialValues = () => {
        setName(initialName());
        setColor(initialColor());
        setComentario("");
    };

    const resetToInitial = () => {
        applyInitialValues();
        setPreviewingOriginal(false);
        setHoverSnapshot(null);
    };

    const previewOriginalOnHover = () => {
        if (isCreate() || !hasUpdateChanges() || isLoading() || previewingOriginal()) return;

        setHoverSnapshot({
            name: name(),
            color: color(),
            comentario: comentario(),
        });

        applyInitialValues();
        setPreviewingOriginal(true);
    };

    const restoreEditedOnLeave = () => {
        if (!previewingOriginal()) return;
        const snapshot = hoverSnapshot();
        if (!snapshot) return;

        setName(snapshot.name);
        setColor(snapshot.color);
        setComentario(snapshot.comentario);
        setPreviewingOriginal(false);
        setHoverSnapshot(null);
    };

    createEffect(() => {
        const cat = props.category;

        if (cat) {
            const currentName = cat.name ?? "";
            const currentColor = cat.color ?? "#ffffff";

            setName(currentName);
            setColor(currentColor);
            setComentario("");

            setInitialName(currentName);
            setInitialColor(currentColor);
            setPreviewingOriginal(false);
            setHoverSnapshot(null);
            return;
        }

        setName("");
        setColor("#ffffff");
        setComentario("");

        setInitialName("");
        setInitialColor("#ffffff");
        setPreviewingOriginal(false);
        setHoverSnapshot(null);
    });

    const handleSave = async () => {
        if (isLoading()) return;

        setIsLoading(true);

        const currentName = name().trim();
        const currentColor = color();

        try {
            if (isCreate()) {
                const data: CategoryCreate = {
                    name: currentName,
                    color: currentColor,
                };

                const res = await createCategory(data);

                if (res.error) {
                    if (res.error.status === 401) {
                        await logout(false);
                        navigate("/login");
                        return;
                    }

                    addToast({ message: res.error.detail, type: "error" });
                    return;
                }

                addToast({ message: "Categoría creada correctamente", type: "success" });
                props.onClose();
                return;
            }

            const payload: CategoryUpdate = {};

            if (currentName !== initialName()) {
                payload.name = currentName;
            }

            if (currentColor !== initialColor()) {
                payload.color = currentColor;
            }
            if (comentario()) {
                payload.comentario = comentario();
            }

            const data = cleanUndefined(payload);

            if (Object.keys(data).length === 0) {
                props.onClose();
                return;
            }

            const res = await updateCategory(props.category!.id, data);

            if (res.error) {
                if (res.error.status === 401) {
                    await logout(false);
                    navigate("/login");
                    return;
                }

                addToast({ message: res.error.detail, type: "error" });
                return;
            }

            addToast({ message: "Categoría actualizada correctamente", type: "success" });
            props.onClose();

        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalCommon onClose={props.onClose} width="460px">
            <div class={styles.container} classList={{ [styles.loading]: isLoading() }}>
                <div class={styles.header}>
                    <h3 class={styles.title}>
                        {isCreate() ? "Nueva categoría" : "Editar categoría"}
                    </h3>
                </div>

                <div class={styles.field}>
                    <label class={styles.label}>Nombre</label>
                    <input
                        type="text"
                        value={name()}
                        onInput={(e) => setName(e.currentTarget.value)}
                        class={styles.input}
                        classList={{ [styles.changedField]: !isCreate() && name().trim() !== initialName() }}
                        maxLength={100}
                        disabled={isLoading()}
                    />
                </div>

                <div class={styles.field}>
                    <label class={styles.label}>Color</label>
                    <div
                        class={styles.colorRow}
                        classList={{ [styles.changedField]: !isCreate() && color() !== initialColor() }}
                    >
                        <input
                            type="color"
                            value={color()}
                            onInput={(e) => setColor(e.currentTarget.value)}
                            class={styles.colorInput}
                            disabled={isLoading()}
                        />
                        <span class={styles.colorValue}>{color()}</span>
                    </div>
                </div>

                {!isCreate() && <div class={styles.field}>
                    <label class={styles.label}>Comentario (Opcional)</label>
                    <textarea
                        value={comentario()}
                        onInput={(e) => setComentario(e.currentTarget.value)}
                        class={styles.input}
                        classList={{ [styles.changedField]: comentario().trim().length > 0 }}
                        maxLength={100}
                        disabled={isLoading()}
                    />
                </div>}

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
                            classList={{ [styles.btnPreviewActive]: hasUpdateChanges() }}
                            disabled={isLoading() || !hasUpdateChanges()}
                            onMouseEnter={previewOriginalOnHover}
                            onMouseLeave={restoreEditedOnLeave}
                            onClick={resetToInitial}
                        >
                            {previewingOriginal() ? "Aplicar cambios" : "Ver cambios"}
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
