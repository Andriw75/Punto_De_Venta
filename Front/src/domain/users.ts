export type UserAdmin = {
  id: number;
  name: string;
  permissions: string[];
};

export type UserCreate = {
  name: string;
  permissions: string[];
  password: string;
};

export type UserUpdate = {
  name?: string;
  permissions?: string[];
  password?: string;
};
