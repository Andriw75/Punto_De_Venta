import { createEffect, createMemo, createSignal, type Component } from "solid-js";
import { useNavigate } from "@solidjs/router";
import ModalCommon from "../../common/UI/ModalCommon";
import { useAuth } from "../../context/auth";
import LoadingLoop from "../../common/IconSvg/LoadingLoop";
import { addToast } from "../../common/UI/Toast/toastStore";
import type { UserAdmin, UserCreate, UserUpdate } from "../../../domain/users";
import { createUser, updateUser } from "../../../infrastructure/users";
import styles from "./ModCUUser.module.css";

type ModCUUserProps = {
  user?: UserAdmin | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

type UserEditSnapshot = {
  name: string;
  password: string;
  selectedPermissions: string[];
};

const PERMISSION_OPTIONS = ["PRODUCTOS", "VENTAS", "USUARIOS", "CATEGORIAS", "AUDITORIA"] as const;

const normalizePermissions = (values: string[]) => {
  const clean = values
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  return [...new Set(clean)].sort();
};

const samePermissions = (a: string[], b: string[]) => {
  const aa = normalizePermissions(a).join(",");
  const bb = normalizePermissions(b).join(",");
  return aa === bb;
};

export const ModCUUser: Component<ModCUUserProps> = (props) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [name, setName] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [selectedPermissions, setSelectedPermissions] = createSignal<string[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);

  const [initialName, setInitialName] = createSignal("");
  const [initialPermissions, setInitialPermissions] = createSignal<string[]>([]);

  const [previewingOriginal, setPreviewingOriginal] = createSignal(false);
  const [hoverSnapshot, setHoverSnapshot] = createSignal<UserEditSnapshot | null>(null);

  const isCreate = createMemo(() => props.user == null);

  const hasUpdateChanges = createMemo(() => {
    if (isCreate()) return false;

    return (
      name().trim() !== initialName() ||
      !samePermissions(selectedPermissions(), initialPermissions()) ||
      password().trim().length > 0
    );
  });

  const applyInitialValues = () => {
    setName(initialName());
    setSelectedPermissions([...initialPermissions()]);
    setPassword("");
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
      password: password(),
      selectedPermissions: [...selectedPermissions()],
    });

    applyInitialValues();
    setPreviewingOriginal(true);
  };

  const restoreEditedOnLeave = () => {
    if (!previewingOriginal()) return;
    const snapshot = hoverSnapshot();
    if (!snapshot) return;

    setName(snapshot.name);
    setPassword(snapshot.password);
    setSelectedPermissions([...snapshot.selectedPermissions]);
    setPreviewingOriginal(false);
    setHoverSnapshot(null);
  };

  createEffect(() => {
    const user = props.user;

    if (!user) {
      setName("");
      setPassword("");
      setSelectedPermissions([]);
      setInitialName("");
      setInitialPermissions([]);
      setPreviewingOriginal(false);
      setHoverSnapshot(null);
      return;
    }

    const permissions = normalizePermissions(user.permissions);

    setName(user.name);
    setPassword("");
    setSelectedPermissions(permissions);

    setInitialName(user.name);
    setInitialPermissions(permissions);
    setPreviewingOriginal(false);
    setHoverSnapshot(null);
  });

  const togglePermission = (permission: string, checked: boolean) => {
    const current = selectedPermissions();

    if (checked) {
      setSelectedPermissions(normalizePermissions([...current, permission]));
      return;
    }

    setSelectedPermissions(current.filter((item) => item !== permission));
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

    const cleanName = name().trim();
    if (!cleanName) {
      addToast({ message: "El nombre de usuario es obligatorio", type: "error" });
      return;
    }

    const permissions = normalizePermissions(selectedPermissions());

    if (isCreate() && password().trim().length < 6) {
      addToast({ message: "La contraseña debe tener al menos 6 caracteres", type: "error" });
      return;
    }

    setIsLoading(true);

    try {
      if (isCreate()) {
        const payload: UserCreate = {
          name: cleanName,
          permissions,
          password: password().trim(),
        };

        const result = await createUser(payload);
        if (result.error) {
          await handleApiError(result.error.status, result.error.detail);
          return;
        }

        addToast({ message: "Usuario creado correctamente", type: "success" });
        await props.onSaved();
        props.onClose();
        return;
      }

      if (!hasUpdateChanges()) {
        props.onClose();
        return;
      }

      const payload: UserUpdate = {};

      if (cleanName !== initialName()) payload.name = cleanName;
      if (!samePermissions(permissions, initialPermissions())) payload.permissions = permissions;

      if (password().trim().length > 0) {
        if (password().trim().length < 6) {
          addToast({ message: "La contraseña debe tener al menos 6 caracteres", type: "error" });
          return;
        }
        payload.password = password().trim();
      }

      const result = await updateUser(props.user!.id, payload);
      if (result.error) {
        await handleApiError(result.error.status, result.error.detail);
        return;
      }

      addToast({ message: "Usuario actualizado correctamente", type: "success" });
      await props.onSaved();
      props.onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalCommon onClose={props.onClose} width="500px">
      <div class={styles.container} classList={{ [styles.loading]: isLoading() }}>
        <h3 class={styles.title}>{isCreate() ? "Nuevo usuario" : "Editar usuario"}</h3>

        <div class={styles.field}>
          <label class={styles.label}>Nombre de usuario</label>
          <input
            type="text"
            class={styles.input}
            classList={{ [styles.changedField]: !isCreate() && name().trim() !== initialName() }}
            value={name()}
            maxLength={100}
            onInput={(e) => setName(e.currentTarget.value)}
            disabled={isLoading()}
          />
        </div>

        <div class={styles.field}>
          <label class={styles.label}>Permisos</label>
          <div
            class={styles.permissionsGrid}
            classList={{ [styles.changedGroup]: !isCreate() && !samePermissions(selectedPermissions(), initialPermissions()) }}
          >
            {PERMISSION_OPTIONS.map((permission) => (
              <label class={styles.permissionOption}>
                <input
                  type="checkbox"
                  checked={selectedPermissions().includes(permission)}
                  onChange={(e) => togglePermission(permission, e.currentTarget.checked)}
                  disabled={isLoading()}
                />
                <span>{permission}</span>
              </label>
            ))}
          </div>
        </div>

        <div class={styles.field}>
          <label class={styles.label}>
            {isCreate() ? "Contraseña" : "Nueva contraseña (opcional)"}
          </label>
          <input
            type="password"
            class={styles.input}
            classList={{ [styles.changedField]: !isCreate() && password().trim().length > 0 }}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            disabled={isLoading()}
          />
        </div>

        {isCreate() ? (
          <div class={styles.buttons}>
            <button class={styles.btnCancel} onClick={props.onClose} disabled={isLoading()}>
              Cancelar
            </button>
            <button class={styles.btnPrimary} onClick={handleSave} disabled={isLoading()}>
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
            <button class={styles.btnCancel} onClick={props.onClose} disabled={isLoading()}>
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
              {previewingOriginal() ? "Aplicar cambios" : "Ver cambios"}
            </button>

            <button
              class={styles.btnPrimary}
              onClick={handleSave}
              disabled={isLoading() || !hasUpdateChanges()}
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
