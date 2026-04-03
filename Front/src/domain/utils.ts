export type ApiError = {
  status: number;
  detail: string;
};

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };
