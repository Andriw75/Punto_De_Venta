import { createSignal, onMount } from "solid-js";
import { useAuth } from "../../context/auth";
import { useNavigate } from "@solidjs/router";
import styles from "./Login.module.css";
import LoadingLoop from "../../common/IconSvg/LoadingLoop";

function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  let usernameRef: HTMLInputElement | undefined;
  let passwordRef: HTMLInputElement | undefined;

  onMount(() => {
    if (user()) {
      navigate("/dashboard");
    }
  });

  const handleLogin = async () => {
    setError("");

    if (!username()) {
      usernameRef?.focus();
      setError("El usuario es obligatorio");
      return;
    }

    if (!password()) {
      passwordRef?.focus();
      setError("La contraseña es obligatoria");
      return;
    }

    setLoading(true);
    try {
      const dataUser = await login(username(), password());
      if (dataUser) {
        navigate("/dashboard");
      } else {
        setError("Credenciales incorrectas");
      }
    } catch (err) {
      setError("Ocurrió un error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div class={styles.container}>
      <div class={styles.formCard}>
        <div class={styles.title}>Punto de Venta</div>

        {error() && <div class={styles.error}>{error()}</div>}

        <div class={styles.fieldGroup}>
          <input
            ref={usernameRef}
            class={styles.inputField}
            type="text"
            placeholder=" "
            value={username()}
            onInput={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading()}
          />
          <label class={styles.floatingLabel}>Usuario</label>
        </div>

        <div class={styles.fieldGroup}>
          <input
            ref={passwordRef}
            class={styles.inputField}
            type="password"
            placeholder=" "
            value={password()}
            onInput={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading()}
          />
          <label class={styles.floatingLabel}>Contraseña</label>
        </div>

        <button
          class={styles.button}
          onClick={handleLogin}
          disabled={loading()}
        >
          {loading() ? <LoadingLoop /> : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

export default Login;