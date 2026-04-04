import {
  createContext,
  useContext,
  createSignal,
  onMount,
  onCleanup,
  type JSXElement,
} from "solid-js";
import type { Accessor } from "solid-js";
import type { ProductoRealTime } from "../../domain/products";
import type { CategoriesRealTime } from "../../domain/categories";

interface WebSocketContextType {
  socket: Accessor<WebSocket | null>;
  isConnected: Accessor<boolean>;
  connect: () => Promise<WebSocket>;
  disconnect: () => void;
  sendMessage: (msg: unknown) => Promise<void>;
  currentProducts: Accessor<ProductoRealTime[]>;
  currentCategories: Accessor<CategoriesRealTime[]>;
}

const WebSocketContext = createContext<WebSocketContextType>();

export const WebSocketProvider = (props: { children: JSXElement }) => {
  const [socket, setSocket] = createSignal<WebSocket | null>(null);
  const [isConnected, setIsConnected] = createSignal(false);
  const [currentProducts, setCurrentProducts] = createSignal<ProductoRealTime[]>([]);
  const [currentCategories, setCurrentCategories] = createSignal<CategoriesRealTime[]>([]);

  const wsUrl = import.meta.env.VITE_CONEX_WS as string;

  let connectingPromise: Promise<WebSocket> | null = null;
  const messageQueue: string[] = [];

  const handleIncoming = (raw: string) => {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }

    if (data?.event === "current_products") {
      setCurrentProducts(data.data ?? []);
      return;
    }

    if (data?.event === "current_categories") {
      setCurrentCategories(data.data ?? []);
      return;
    }

    console.log("WS event:", data);
  };

  const flushQueue = (ws: WebSocket) => {
    while (messageQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
      const payload = messageQueue.shift();
      if (payload) ws.send(payload);
    }
  };

  const connect = (): Promise<WebSocket> => {
    const existing = socket();
    if (existing && existing.readyState === WebSocket.OPEN) {
      return Promise.resolve(existing);
    }

    if (connectingPromise) {
      return connectingPromise;
    }

    connectingPromise = new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setSocket(ws);
        setIsConnected(true);
        connectingPromise = null;
        flushQueue(ws);
        resolve(ws);
      };

      ws.onmessage = (event) => {
        handleIncoming(event.data);
      };

      ws.onerror = (err) => {
        connectingPromise = null;
        reject(err);
      };

      ws.onclose = () => {
        setSocket(null);
        setIsConnected(false);
        connectingPromise = null;
      };
    });

    return connectingPromise;
  };

  const sendMessage = async (msg: unknown) => {
    const payload = typeof msg === "string" ? msg : JSON.stringify(msg);

    const ws = socket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      return;
    }

    messageQueue.push(payload);
    await connect();
  };

  const disconnect = () => {
    const ws = socket();
    if (ws) {
      ws.close();
    } else {
      setIsConnected(false);
    }
  };

  onMount(() => {
    void connect();
  });

  onCleanup(() => {
    disconnect();
  });

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        connect,
        disconnect,
        sendMessage,
        currentProducts,
        currentCategories,
      }}
    >
      {props.children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket debe usarse dentro de WebSocketProvider");
  }
  return ctx;
};