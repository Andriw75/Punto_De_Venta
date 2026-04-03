import {
  createContext,
  useContext,
  createSignal,
  onMount,
  type JSXElement,
} from "solid-js";
import type { Accessor } from "solid-js";
import type { User } from "../../domain/auth";
import { authService } from "../../infrastructure/auth";

interface AuthContextType {
  user: Accessor<User | null>;
  login: (username: string, password: string) => Promise<User | null>;
  logout: (call?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider = (props: { children: JSXElement }) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [loading, setLoading] = createSignal(true);

  const refreshUser = async () => {
    try {
      const data = await authService.fetchMe();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const data = await authService.login(username, password);
      setUser(data);
      return data;
    } catch (err) {
      console.error("Error en login:", err);
      setUser(null);
      return null;
    }
  };

  const logout = async (call: boolean = true) => {
    try {
      if (call) await authService.logout();
    } finally {
      setUser(null);
    }
  };

  onMount(() => {
    void refreshUser();
  });

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {loading() ? <div>Cargando...</div> : props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};