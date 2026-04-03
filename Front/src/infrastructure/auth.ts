import type { User } from "../domain/auth";
import { handleResponse } from "./utils";

const API_URL = import.meta.env.VITE_API_URL;

export const authService = {
  async fetchMe(): Promise<User | null> {
    const res = await handleResponse<User>(`${API_URL}/auth/me`);
    return res.data;
  },
  async login(username: string, password: string): Promise<User | null> {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    const res = await handleResponse<User>(`${API_URL}/auth/token`, {
      method: "POST",
      body: formData,
    });
    return res.data;
  },
  async logout(): Promise<void> {
    await handleResponse<void>(`${API_URL}/auth/logout`, { method: "POST" });
  }
};
