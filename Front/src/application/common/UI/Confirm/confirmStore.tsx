import { Show, createSignal, type JSX } from "solid-js";
import ConfirmModal from "./ConfirmModal";
import type { ApiResponse } from "../../../../domain/utils";

const [open, setOpen] = createSignal(false);
const [title, setTitle] = createSignal("");
const [message, setMessage] = createSignal("");

export type ConfirmResult<T> = ApiResponse<T> | null;

let confirmResolve: ((result: ConfirmResult<any>) => void) | null = null;
let confirmFn: (() => Promise<ApiResponse<any>>) | null = null;

export function confirm<T>(
  titleText: string,
  msg: string,
  fn: () => Promise<ApiResponse<T>>,
): Promise<ConfirmResult<T>> {
  setTitle(titleText);
  setMessage(msg);
  confirmFn = fn;

  setOpen(true);

  return new Promise<ConfirmResult<T>>((resolve) => {
    confirmResolve = resolve;
  });
}


export const ConfirmContainer = (): JSX.Element => {
  return (
    <Show when={open()}>
      <ConfirmModal
        title={title()}
        message={message()}
        onClose={() => {
          setOpen(false);
          confirmResolve?.(null);
          confirmResolve = null;
          confirmFn = null;
        }}
        onConfirm={async (): Promise<boolean> => {
          if (!confirmFn) return false;

          const result = await confirmFn();
          setOpen(false);

          const ok = result.error === null;
          confirmResolve?.(result);
          confirmResolve = null;
          confirmFn = null;

          return ok;
        }}
      />
    </Show>
  );
};
