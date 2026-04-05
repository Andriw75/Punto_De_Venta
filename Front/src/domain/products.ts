export type ProductoBase = {
    name: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    stock: number;
    barcode?: string | null;
};

export type ProductoRealTime = ProductoBase & {
    id: number;
    category_id?: number | null;
    price: number;
};

export type ProductoCreate = ProductoBase & {
    category_id?: number | null;
    price: number;
};

export type ProductoUpdate = {
    name?: string | null;
    description?: string | null;
    metadata?: Record<string, any> | null;
    stock?: number | null;
    barcode?: string | null;
    price?: number | null;
    category_id?: number | null;
    comentario?: string | null;
};
