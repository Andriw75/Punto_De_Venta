import type { PaymentMethodCreate, PaymentMethodUpdate } from "../domain/payment_methods";
import type { ApiResponse } from "../domain/utils";
import { buildQuery, cleanUndefined, handleResponse } from "./utils";

const urlBase = `${import.meta.env.VITE_API_URL}/PaymentMethods`;

export async function createPaymentMethod(
  data: PaymentMethodCreate,
): Promise<ApiResponse<boolean>> {
  return await handleResponse<boolean>(`${urlBase}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function updatePaymentMethod(
  paymentMethodId: number,
  data: PaymentMethodUpdate,
): Promise<ApiResponse<boolean>> {
  const query = buildQuery({ method_id: paymentMethodId });

  return await handleResponse<boolean>(`${urlBase}/?${query}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleanUndefined(data)),
  });
}

export async function deletePaymentMethod(
  paymentMethodId: number,
  comentario?: string,
): Promise<ApiResponse<boolean>> {
  const query = buildQuery({ method_id: paymentMethodId, comentario });

  return await handleResponse<boolean>(`${urlBase}/?${query}`, {
    method: "DELETE",
  });
}
