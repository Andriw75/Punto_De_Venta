import { type Component, onMount } from "solid-js";
import { Router, Route, useNavigate } from "@solidjs/router";
import DashboardLayout from "./Pages/Dashboard/DashboardLayout";
import Login from "./Pages/Login/Login";
import { useAuth } from "./context/auth";
import { findFirstAllowedRoute } from "./Pages/Dashboard/Sidebar";
import Categorias from "./PagesD/Categorias";
import Products from "./PagesD/Products";
import Users from "./PagesD/Users";
import PaymentMethods from "./PagesD/PaymentMethods";
import Sales from "./PagesD/Sales";

const Redirect: Component<{ to: string }> = (props) => {
  const nav = useNavigate();
  onMount(() => nav(props.to, { replace: true }));
  return null;
};

function withProtection(
  Comp: Component<any>,
  requiredPermission?: string,
): Component {
  return () => {
    const auth = useAuth();
    const nav = useNavigate();

    onMount(() => {
      const u = auth.user();
      if (!u) {
        nav("/login", { replace: true });
        return;
      }
      if (requiredPermission && !u.permissions.includes(requiredPermission)) {
        const first = findFirstAllowedRoute(u.permissions);
        if (first) nav(first, { replace: true });
        else nav("/login", { replace: true });
      }
    });

    return <Comp />;
  };
}


const App: Component = () => {
  const basePath = import.meta.env.VITE_APP_BASE_PATH || "/";
  return (
    <Router base={basePath}>
      <Route path="/" component={() => <Redirect to="/login" />} />
      <Route path="/login" component={Login} />

      <Route component={DashboardLayout}>
        <Route
          path="/dashboard"
          component={() => {
            return <Redirect to="/dashboard" />;
          }}
        />

        <Route
          path="/dashboard/categorias"
          component={withProtection(Categorias, "CATEGORIAS")}
        />
        <Route
          path="/dashboard/productos"
          component={withProtection(Products, "PRODUCTOS")}
        />
        <Route
          path="/dashboard/usuarios"
          component={withProtection(Users, "USUARIOS")}
        />
        <Route
          path="/dashboard/metodos-de-pago"
          component={withProtection(PaymentMethods, "VENTAS")}
        />
        <Route
          path="/dashboard/ventas"
          component={withProtection(Sales, "VENTAS")}
        />


      </Route>
    </Router>
  );
};

export default App;
