import { Show, createSignal, type JSX } from "solid-js";
import ConfirmModal from "./ConfirmModal";
import type { ApiResponse } from "../../../../domain/utils";

const [open, setOpen] = createSignal(false);
const [title, setTitle] = createSignal("");
const [message, setMessage] = createSignal("");
const [content, setContent] = createSignal<JSX.Element | undefined>(undefined);
const [confirmText, setConfirmText] = createSignal("Aceptar");
const [cancelText, setCancelText] = createSignal("Cancelar");
const [disableConfirm, setDisableConfirm] = createSignal(false);

export type ConfirmResult<T> = ApiResponse<T> | null;

type ConfirmOptions<T> = {
  title: string;
  message?: string;
  content?: JSX.Element;
  confirmText?: string;
  cancelText?: string;
  disableConfirm?: boolean;
  fn: () => Promise<ApiResponse<T>>;
};

let confirmResolve: ((result: ConfirmResult<any>) => void) | null = null;
let confirmFn: (() => Promise<ApiResponse<any>>) | null = null;

function resetState() {
  setOpen(false);
  setTitle("");
  setMessage("");
  setContent(undefined);
  setConfirmText("Aceptar");
  setCancelText("Cancelar");
  setDisableConfirm(false);
  confirmResolve = null;
  confirmFn = null;
}

export function confirm<T>(
  titleText: string,
  msg: string,
  fn: () => Promise<ApiResponse<T>>,
): Promise<ConfirmResult<T>> {
  return confirmWithOptions({
    title: titleText,
    message: msg,
    fn,
  });
}

export function confirmWithOptions<T>(
  options: ConfirmOptions<T>,
): Promise<ConfirmResult<T>> {
  setTitle(options.title);
  setMessage(options.message ?? "");
  setContent(options.content);
  setConfirmText(options.confirmText ?? "Aceptar");
  setCancelText(options.cancelText ?? "Cancelar");
  setDisableConfirm(options.disableConfirm ?? false);
  confirmFn = options.fn;

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
        content={content()}
        confirmText={confirmText()}
        cancelText={cancelText()}
        disableConfirm={disableConfirm()}
        onClose={() => {
          confirmResolve?.(null);
          resetState();
        }}
        onConfirm={async (): Promise<boolean> => {
          if (!confirmFn) return false;

          const result = await confirmFn();
          const ok = result.error === null;
          confirmResolve?.(result);
          resetState();

          return ok;
        }}
      />
    </Show>
  );
};
