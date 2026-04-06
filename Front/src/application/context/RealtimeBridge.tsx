import { createEffect, createSignal } from "solid-js";
import { useAuth } from "./auth";
import { useWebSocket } from "./web_socket";

export const RealtimeBridge = () => {
    const auth = useAuth();
    const ws = useWebSocket();

    const [subscribedProducts, setSubscribedProducts] = createSignal(false);
    const [subscribedCategories, setSubscribedCategories] = createSignal(false);
    const [subscribedPaymentMethods, setSubscribedPaymentMethods] = createSignal(false);

    createEffect(async () => {
        const user = auth.user();
        const connected = ws.isConnected();

        if (!user) {
            setSubscribedProducts(false);
            setSubscribedCategories(false);
            setSubscribedPaymentMethods(false);
            return;
        }

        if (!connected) {
            setSubscribedProducts(false);
            setSubscribedCategories(false);
            setSubscribedPaymentMethods(false);
            await ws.connect();
            return;
        }

        const canProducts = user.permissions.includes("PRODUCTOS");
        const canCategories = user.permissions.includes("CATEGORIAS");
        const canPaymentMethods = user.permissions.includes("VENTAS");

        if (canProducts && !subscribedProducts()) {
            setSubscribedProducts(true);
            void ws.sendMessage({ event: "subscribe_products" });
        }

        if (canCategories && !subscribedCategories()) {
            setSubscribedCategories(true);
            void ws.sendMessage({ event: "subscribe_categories" });
        }

        if (canPaymentMethods && !subscribedPaymentMethods()) {
            setSubscribedPaymentMethods(true);
            void ws.sendMessage({ event: "subscribe_payment_methods" });
        }
    });

    return null;
};
