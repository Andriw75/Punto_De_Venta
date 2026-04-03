import { Show, createSignal, type JSX } from "solid-js";
import ConfirmModal from "./ConfirmModal";

const [open, setOpen] = createSignal(false);
const [title, setTitle] = createSignal("");
const [message, setMessage] = createSignal("");

export type ConfirmResult = boolean | null;

let confirmResolve: (ok: ConfirmResult) => void;
let confirmFn: () => Promise<ConfirmResult>;

export const confirm = (
  titleText: string,
  msg: string,
  fn: () => Promise<boolean>
): Promise<ConfirmResult> => {
  setTitle(titleText);
  setMessage(msg);
  confirmFn = fn;

  setOpen(true);

  return new Promise<ConfirmResult>((resolve) => {
    confirmResolve = resolve;
  });
};

export const ConfirmContainer = (): JSX.Element => {
  return (
    <Show when={open()}>
      <ConfirmModal
        title={title()}
        message={message()}
        onClose={() => {
          setOpen(false);
          confirmResolve(null);
        }}
        onConfirm={async () => {
          const ok = await confirmFn();
          setOpen(false);
          confirmResolve(ok);
          return ok;
        }}
      />
    </Show>
  );
};
