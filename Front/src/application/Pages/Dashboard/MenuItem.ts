import type { Component } from "solid-js";
import Money16 from "../../common/IconSvg/Money16";
import Labels from "../../common/IconSvg/Labels";
import User from "../../common/IconSvg/User";

export type MenuItem = {
  label: string;
  key: string;
  route?: string;
  component?: Component<any>;
  submenu?: MenuItem[];
  requiredPermission?: string;
  icon?: {
    component: Component<any>;
    props?: Record<string, any>;
  };
};

export const menu: MenuItem[] = [
  {
    label: "Categorias",
    key: "CATEGORIAS",
    route: "/dashboard/categorias",
    requiredPermission: "CATEGORIAS",
    icon: { component: Labels, props: { width: "20px", height: "20px" } },
  },
  // {
  //   label: "Metodos de pago",
  //   key: "PAYMENT_METHODS",
  //   route: "/dashboard/metodos-de-pago",
  //   requiredPermission: "VENTAS",
  //   icon: { component: Payment16Regular, props: { width: "20px", height: "20px" } },
  // },
  {
    label: "Productos",
    key: "PRODUCTOS",
    route: "/dashboard/productos",
    requiredPermission: "PRODUCTOS",
    icon: { component: Money16, props: { width: "30px", height: "30px" } },
  },
  // {
  //   label: "Ventas",
  //   key: "VENTAS",
  //   route: "/dashboard/ventas",
  //   requiredPermission: "VENTAS",
  //   icon: { component: Bag, props: { width: "30px", height: "30px" } },
  // },
  {
    label: "Usuarios",
    key: "USUARIOS",
    route: "/dashboard/usuarios",
    requiredPermission: "USUARIOS",
    icon: { component: User, props: { width: "20px", height: "20px" } },
  },

];

