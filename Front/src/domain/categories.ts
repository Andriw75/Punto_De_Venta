export interface CategoriesRealTime {
    id: number;
    name: string;
    color: string;
}

export interface CategoryCreate {
    name: string;
    color: string;
}

export interface CategoryUpdate {
    name?: string | null;
    color?: string | null;
    comentario?: string | null;
}