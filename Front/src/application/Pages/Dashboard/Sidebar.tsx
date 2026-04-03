// Sidebar.tsx
import { Dynamic } from "solid-js/web";
import {
  createSignal,
  onMount,
  createEffect,
  type Component,
  For,
  Show,
  createMemo,
} from "solid-js";
import styles from "./Sidebar.module.css";
import LoadingLoop from "../../common/IconSvg/LoadingLoop";
import Close from "../../common/IconSvg/Close";
import UserSolid from "../../common/IconSvg/UserSolid";
import { useNavigate, useLocation } from "@solidjs/router";
import { useAuth } from "../../context/auth";
import { type MenuItem, menu } from "./MenuItem";

type SidebarProps = {
  onCollapseChange?: (collapsed: boolean) => void;
};

/** Component pequeño para renderizar submenus recursivamente */
const MenuList: Component<{
  items: MenuItem[];
  openMenus: string[];
  toggleMenu: (key: string) => void;
  handleSelect: (item: MenuItem) => void;
  selectedKey: () => string | null;
  isCollapsed: () => boolean;
  isMobile: () => boolean;
  isExpandedMobile: () => boolean;
}> = (props) => {
  return (
    <ul class={styles.menuList}>
      <For each={props.items}>
        {(item) => {
          const hasSubmenu = !!item.submenu && item.submenu.length > 0;
          const isOpen = () => props.openMenus.includes(item.key);
          const isActive = () => props.selectedKey() === item.key;

          const title =
            props.isCollapsed() ||
              (props.isMobile() && !props.isExpandedMobile())
              ? item.label
              : "";

          return (
            <li class={styles.menuItem}>
              {hasSubmenu ? (
                <>
                  <div
                    class={styles.toggleLabel}
                    onClick={() => props.toggleMenu(item.key)}
                  >
                    <div class={styles.toggleContent}>
                      <div class={styles.menuIcon}>
                        <Show
                          when={item.icon}
                          fallback={<LoadingLoop width="20" height="20" />}
                        >
                          <Dynamic
                            component={item.icon!.component}
                            {...(item.icon!.props || {})}
                          />
                        </Show>
                      </div>
                      <span class={styles.menuText}>{item.label}</span>
                    </div>
                    <span
                      class={`${styles.arrow} ${isOpen() ? styles.open : ""}`}
                    >
                      ▶
                    </span>
                  </div>
                  <Show when={isOpen()}>
                    <div class={styles.submenu}>
                      <MenuList
                        items={item.submenu!}
                        openMenus={props.openMenus}
                        toggleMenu={props.toggleMenu}
                        handleSelect={props.handleSelect}
                        selectedKey={props.selectedKey}
                        isCollapsed={props.isCollapsed}
                        isMobile={props.isMobile}
                        isExpandedMobile={props.isExpandedMobile}
                      />
                    </div>
                  </Show>
                </>
              ) : (
                <button
                  classList={{
                    [styles.button]: true,
                    [styles.active]: isActive(),
                  }}
                  onClick={() => props.handleSelect(item)}
                  title={title}
                >
                  <div class={styles.menuIcon}>
                    <Show
                      when={item.icon}
                      fallback={<LoadingLoop width="20" height="20" />}
                    >
                      <Dynamic
                        component={item.icon!.component}
                        {...(item.icon!.props || {})}
                      />
                    </Show>
                  </div>
                  <span class={styles.menuText}>{item.label}</span>
                </button>
              )}
            </li>
          );
        }}
      </For>
    </ul>
  );
};

const Sidebar: Component<SidebarProps> = (props) => {
  const [openMenus, setOpenMenus] = createSignal<string[]>([]);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);
  const [isExpandedMobile, setIsExpandedMobile] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = createMemo(() =>
    findMenuKeyByRoute(menu, location.pathname),
  );

  // cada vez que cambia la ruta, abro parents
  createEffect(() => {
    const key = selectedKey();
    if (key) {
      const parentKeys = findParentKeys(menu, key);
      setOpenMenus(parentKeys);
    }
  });

  onMount(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const setFromMQ = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setIsCollapsed(true);
    };
    setFromMQ();
    const listener = () => setFromMQ();
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  });

  const toggleMenu = (key: string) => {
    if (!isMobile() && isCollapsed()) return;
    if (isMobile() && !isExpandedMobile()) return;
    setOpenMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSelect = (item: MenuItem) => {
    if (item.route) navigate(item.route);
    if (isMobile() && isExpandedMobile()) setIsExpandedMobile(false);
  };

  const toggleSidebar = () => {
    if (isMobile()) {
      setIsExpandedMobile(!isExpandedMobile());
    } else {
      const newVal = !isCollapsed();
      setIsCollapsed(newVal);
      props.onCollapseChange?.(newVal);
      if (newVal) setOpenMenus([]);
    }
  };

  const visibleMenu = createMemo(() =>
    filterMenuByPermissions(auth.user()?.permissions || [], menu),
  );

  return (
    <nav
      classList={{
        [styles.sidebar]: true,
        [styles.collapsed]: isCollapsed() && !isMobile(),
        [styles.expanded]: isMobile() && isExpandedMobile(),
      }}
    >
      <div
        class={styles.userSection}
        onClick={toggleSidebar}
        role="button"
        tabindex={0}
      >
        <UserSolid class={styles.userIcon} />
        <div class={styles.userName}>{auth.user()?.name || "Usuario"}</div>
        <div
          class={styles.arrow}
          style={{
            "margin-left": "auto",
            transform: isMobile()
              ? isExpandedMobile()
                ? "rotate(90deg)"
                : "rotate(0)"
              : isCollapsed()
                ? "rotate(90deg)"
                : "rotate(0)",
          }}
        />
      </div>

      <div class={styles.menuContainer}>
        <MenuList
          items={visibleMenu()}
          openMenus={openMenus()}
          toggleMenu={toggleMenu}
          handleSelect={handleSelect}
          selectedKey={selectedKey}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          isExpandedMobile={isExpandedMobile}
        />
      </div>

      <button
        class={styles.logoutButton}
        onClick={async () => {
          setIsLoading(true);
          try {
            await auth.logout();
          } finally {
            setIsLoading(false);
            navigate("/login");
          }
        }}
        disabled={isLoading()}
      >
        {isLoading() ? (
          <LoadingLoop width="1.2em" height="1.2em" />
        ) : (
          <Close class={styles.logoutIcon} />
        )}
        <Show when={!isCollapsed() && !(isMobile() && !isExpandedMobile())}>
          <span class={styles.logoutText}>Cerrar sesión</span>
        </Show>
      </button>
    </nav>
  );
};

export default Sidebar;

/* Helpers: findMenuKeyByRoute, findParentKeys, filterMenuByPermissions, findFirstAllowedRoute
   (idénticos en lógica a los tuyos, pero los dejo aquí por claridad). */

export function findMenuKeyByRoute(
  items: MenuItem[],
  path: string,
): string | null {
  let bestMatch: string | null = null;
  let bestLength = -1;

  const search = (itemsLocal: MenuItem[]) => {
    for (const it of itemsLocal) {
      if (it.route && path.startsWith(it.route)) {
        if (it.route.length > bestLength) {
          bestLength = it.route.length;
          bestMatch = it.key;
        }
      }
      if (it.submenu) search(it.submenu);
    }
  };

  search(items);
  return bestMatch;
}

export function findParentKeys(
  items: MenuItem[],
  targetKey: string,
  parents: string[] = [],
): string[] {
  for (const it of items) {
    if (it.key === targetKey) return parents;
    if (it.submenu) {
      const result = findParentKeys(it.submenu, targetKey, [
        ...parents,
        it.key,
      ]);
      if (result.length > 0) return result;
    }
  }
  return [];
}

export const filterMenuByPermissions = (
  userPermissions: string[],
  items: MenuItem[],
): MenuItem[] =>
  items
    .map((item) => {
      if (item.submenu) {
        const filteredSubmenu = filterMenuByPermissions(
          userPermissions,
          item.submenu,
        );
        return { ...item, submenu: filteredSubmenu };
      }
      return item;
    })
    .filter((item) => {
      if (item.submenu && item.submenu.length > 0) return true;
      return (
        !item.requiredPermission ||
        userPermissions.includes(item.requiredPermission)
      );
    });

export function findFirstAllowedRoute(
  userPermissions: string[] | undefined,
): string | null {
  if (!userPermissions) return null;
  for (const it of menu) {
    if (!it.requiredPermission) return it.route ?? null;
    if (userPermissions.includes(it.requiredPermission))
      return it.route ?? null;
  }
  return null;
}
