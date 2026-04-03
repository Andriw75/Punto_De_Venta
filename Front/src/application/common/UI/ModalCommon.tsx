import { createSignal } from "solid-js";
import type { Component, JSX } from "solid-js";
import styles from "./ModalCommon.module.css";

interface ModalCommonProps {
  onClose: () => void;
  children: JSX.Element;
  closeOnOverlayClick?: boolean;
  width?: string;
}

const useModalLogic = (onClose: () => void) => {
  const [exiting, setExiting] = createSignal(false);

  const close = () => {
    setExiting(true);
    setTimeout(() => onClose(), 300);
  };

  return {
    exiting,
    close,
  };
};

const ModalCommon: Component<ModalCommonProps> = (props) => {
  const { exiting, close } = useModalLogic(props.onClose);
  const { closeOnOverlayClick = false } = props;

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      close();
    }
  };

  return (
    <div
      class={`${styles.overlay} ${exiting() ? styles.exit : ""}`}
      onClick={handleOverlayClick}
    >
      <div
        class={`${styles.modal} ${exiting() ? styles.exit : ""}`}
        style={{ width: props.width ?? "350px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          class={styles.closeButton}
          onClick={close}
          aria-label="Cerrar modal"
        >
          ×
        </button>
        {props.children}
      </div>
    </div>
  );
};

export default ModalCommon;
