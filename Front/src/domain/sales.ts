export type SaleItemCreate = {
  product_id: number;
  quantity: number;
};

export type SaleItemUpdate = {
  product_id: number;
  quantity: number;
};

export type SaleCreate = {
  products: SaleItemCreate[];
  total_charged: number;
  payment_method_id: number;
};

export type SaleUpdate = {
  products?: SaleItemUpdate[];
  total_charged?: number;
  payment_method_id?: number;
  comentario?: string | null;
};

export type SaleItemResponse = {
  product_id: number;
  snapshot_id: number;
  name: string;
  unit_price: number;
  quantity: number;
};

export type SaleResponse = {
  id: number;
  username?: string | null;
  sale_date: string;
  products: SaleItemResponse[];
  total_charged: number;
  payment_method_id: number;
};

export type SalesListFilters = {
  offset?: number;
  limit?: number;
  start_time?: string;
  end_time?: string;
};

export type SalesCountFilters = {
  start_time?: string;
  end_time?: string;
};
