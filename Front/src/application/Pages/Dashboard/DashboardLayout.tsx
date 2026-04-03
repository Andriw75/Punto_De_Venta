import { type ParentComponent, createSignal, onMount } from "solid-js";
import Sidebar from "./Sidebar";
import styles from "./DashboardLayout.module.css";
import { useAuth } from "../../context/auth";
import { useNavigate } from "@solidjs/router";

const DashboardLayout: ParentComponent = (props) => {
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const { user } = useAuth();
  const nav = useNavigate();

  onMount(() => {
    if (!user()) {
      nav("/login", { replace: true });
      return;
    }
  });

  return (
    <div class={styles.wrapper}>
      <div
        classList={{
          [styles.sidebarWrap]: true,
          [styles.sidebarWrapCollapsed]: sidebarCollapsed(),
        }}
      >
        <Sidebar onCollapseChange={(c) => setSidebarCollapsed(c)} />
      </div>

      <main class={styles.mainContent}>{props.children}</main>
    </div>
  );
};

export default DashboardLayout;
