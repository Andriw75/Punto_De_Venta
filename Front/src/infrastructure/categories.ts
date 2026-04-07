import { buildQuery, cleanUndefined, handleResponse } from "./utils";
import type { CategoryCreate, CategoryUpdate } from "../domain/categories";
import type { ApiResponse } from "../domain/utils";

const url_base = import.meta.env.VITE_API_URL + "/Categories";

export async function createCategory(data: CategoryCreate): Promise<ApiResponse<boolean>> {

    return await handleResponse<boolean>(url_base + "/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })

}

export async function updateCategory(
    category_id: number,
    data: CategoryUpdate
): Promise<ApiResponse<boolean>> {
    const params = buildQuery({
        category_id: category_id,
    });

    return await handleResponse<boolean>(`${url_base}/?${params}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanUndefined(data)),
    });
}

export async function deleteCategory(
    category_id: number,
    comentario?: string,
): Promise<ApiResponse<boolean>> {
    const params = buildQuery({
        category_id: category_id,
        comentario,
    });



    return await handleResponse<boolean>(`${url_base}/?${params.toString()}`, {
        method: "DELETE",
    });

}
