import { createEffect } from "solid-js";
import { useAuth } from "./auth";
import { useWebSocket } from "./web_socket";
import { createSignal } from "solid-js";

export const RealtimeBridge = () => {
    const auth = useAuth();
    const ws = useWebSocket();

    const [subscribedProducts, setSubscribedProducts] = createSignal(false);
    const [subscribedCategories, setSubscribedCategories] = createSignal(false);

    createEffect(() => {
        const user = auth.user();
        const connected = ws.isConnected();

        if (!user || !connected) return;

        const canProducts = user.permissions.includes("PRODUCTOS");
        const canCategories = user.permissions.includes("CATEGORIAS");

        if (canProducts && !subscribedProducts()) {
            void ws.sendMessage({ event: "subscribe_products" });
            setSubscribedProducts(true);
        }

        if (canCategories && !subscribedCategories()) {
            void ws.sendMessage({ event: "subscribe_categories" });
            setSubscribedCategories(true);
        }

        if (!user) {
            setSubscribedProducts(false);
            setSubscribedCategories(false);
        }
    });

    return null;
};