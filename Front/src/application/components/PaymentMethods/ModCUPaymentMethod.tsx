import { createEffect, createSignal, type Component } from "solid-js";
import { useNavigate } from "@solidjs/router";

import ModalCommon from "../../common/UI/ModalCommon";
import LoadingLoop from "../../common/IconSvg/LoadingLoop";
import { addToast } from "../../common/UI/Toast/toastStore";
import { useAuth } from "../../context/auth";

import type {
  PaymentMethodCreate,
  PaymentMethodRealTime,
  PaymentMethodUpdate,
} from "../../../domain/payment_methods";
import {
  createPaymentMethod,
  updatePaymentMethod,
} from "../../../infrastructure/payment_methods";

import styles from "../Categories/ModCUCat.module.css";

type ModCUPaymentMethodProps = {
  onClose: () => void;
  method?: PaymentMethodRealTime | null;
};

export const ModCUPaymentMethod: Component<ModCUPaymentMethodProps> = (props) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [name, setName] = createSignal("");
  const [comentario, setComentario] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [initialName, setInitialName] = createSignal("");

  const isCreate = () => props.method == null;
  const hasUpdateChanges = () => {
    if (isCreate()) return false;
    return name().trim() !== initialName() || comentario().trim().length > 0;
  };

  createEffect(() => {
    const method = props.method;

    if (!method) {
      setName("");
      setComentario("");
      setInitialName("");
      return;
    }

    setName(method.name ?? "");
    setComentario("");
    setInitialName(method.name ?? "");
  });

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

    const cleanName = name().trim();
    if (!cleanName) {
      addToast({ message: "El nombre es obligatorio", type: "error" });
      return;
    }

    setIsLoading(true);

    try {
      if (isCreate()) {
        const payload: PaymentMethodCreate = { name: cleanName };
        const result = await createPaymentMethod(payload);

        if (result.error) {
          await handleApiError(result.error.status, result.error.detail);
          return;
        }

        addToast({ message: "Método de pago creado correctamente", type: "success" });
        props.onClose();
        return;
      }

      const payload: PaymentMethodUpdate = {};
      if (cleanName !== initialName()) payload.name = cleanName;
      if (comentario().trim()) payload.comentario = comentario().trim();

      if (Object.keys(payload).length === 0) {
        props.onClose();
        return;
      }

      const result = await updatePaymentMethod(props.method!.id, payload);
      if (result.error) {
        await handleApiError(result.error.status, result.error.detail);
        return;
      }

      addToast({ message: "Método de pago actualizado correctamente", type: "success" });
      props.onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalCommon onClose={props.onClose} width="460px">
      <div class={styles.container} classList={{ [styles.loading]: isLoading() }}>
        <div class={styles.header}>
          <h3 class={styles.title}>{isCreate() ? "Nuevo método de pago" : "Editar método de pago"}</h3>
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

        {!isCreate() && (
          <div class={styles.field}>
            <label class={styles.label}>Comentario (Opcional)</label>
            <textarea
              value={comentario()}
              onInput={(e) => setComentario(e.currentTarget.value)}
              class={styles.input}
              classList={{ [styles.changedField]: comentario().trim().length > 0 }}
              maxLength={200}
              disabled={isLoading()}
            />
          </div>
        )}

        <div class={styles.buttons}>
          <button class={styles.btnCancel} onClick={props.onClose} disabled={isLoading()}>
            Cancelar
          </button>

          <button
            class={styles.btnPrimary}
            onClick={handleSave}
            disabled={isLoading() || (!isCreate() && !hasUpdateChanges())}
          >
            {isLoading() ? (
              <span class={styles.loadingContent}>
                <LoadingLoop />
                Guardando...
              </span>
            ) : isCreate() ? (
              "Guardar"
            ) : (
              "Actualizar"
            )}
          </button>
        </div>
      </div>
    </ModalCommon>
  );
};
