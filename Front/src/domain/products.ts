export type ProductoBase = {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    stock: number;
    barcode?: string;
};

export type ProductoRealTime = ProductoBase & {
    id: number;
    category_id?: number;
    price: number;
};

export type ProductoCreate = ProductoBase & {
    category_id?: number;
    price: number;
};

export type ProductoUpdate = {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    stock?: number;
    barcode?: string;
    price?: number;
    category_id?: number;
};