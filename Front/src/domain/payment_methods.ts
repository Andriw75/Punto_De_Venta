export interface PaymentMethodRealTime {
  id: number;
  name: string;
}

export interface PaymentMethodCreate {
  name: string;
}

export interface PaymentMethodUpdate {
  name?: string | null;
  comentario?: string | null;
}
