import { createEffect, createSignal } from "solid-js";
import { useAuth } from "./auth";
import { useWebSocket } from "./web_socket";

export const RealtimeBridge = () => {
    const auth = useAuth();
    const ws = useWebSocket();

    const [subscribedProducts, setSubscribedProducts] = createSignal(false);
    const [subscribedCategories, setSubscribedCategories] = createSignal(false);

    createEffect(async () => {
        const user = auth.user();
        const connected = ws.isConnected();

        if (!user) {
            setSubscribedProducts(false);
            setSubscribedCategories(false);
            return;
        }

        if (!connected) {
            await ws.connect();
            return;
        }

        const canProducts = user.permissions.includes("PRODUCTOS");
        const canCategories = user.permissions.includes("CATEGORIAS");

        if (canProducts && !subscribedProducts()) {
            setSubscribedProducts(true);
            void ws.sendMessage({ event: "subscribe_products" });
        }

        if (canCategories && !subscribedCategories()) {
            setSubscribedCategories(true);
            void ws.sendMessage({ event: "subscribe_categories" });
        }
    });

    return null;
};