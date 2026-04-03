import { type Component, onMount } from "solid-js";
import { Router, Route, useNavigate } from "@solidjs/router";
import DashboardLayout from "./Pages/Dashboard/DashboardLayout";
import Login from "./Pages/Login/Login";

const Redirect: Component<{ to: string }> = (props) => {
  const nav = useNavigate();
  onMount(() => nav(props.to, { replace: true }));
  return null;
};


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


      </Route>
    </Router>
  );
};

export default App;
