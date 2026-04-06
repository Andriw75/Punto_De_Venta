import {
  createSignal,
  createEffect,
  createMemo,
  onCleanup,
  type Component,
} from "solid-js";
import style from "./Pagination.module.css";

type PaginationProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages?: number;
};

type PageItem = number | "ellipsis";

const Pagination: Component<PaginationProps> = (props) => {
  const [inputValue, setInputValue] = createSignal(
    props.currentPage.toString()
  );
  const [isOpen, setIsOpen] = createSignal(false);

  createEffect(() => {
    setInputValue(props.currentPage.toString());
  });

  const pages = createMemo(() => {
    if (!props.totalPages) return [];
    return Array.from({ length: props.totalPages }, (_, i) => i + 1);
  });

  const filteredPages = createMemo(() => {
    const value = inputValue().trim();
    if (!value) return pages();
    return pages().filter((p) => p.toString().startsWith(value));
  });

  const sidePages = () => {
    if (!props.totalPages) return null;

    const total = props.totalPages;
    const current = props.currentPage;
    const range = 2;

    const before: PageItem[] = [];
    const after: PageItem[] = [];

    if (current > 1) {
      before.push(1);

      if (current - range > 2) before.push("ellipsis");

      for (let i = Math.max(2, current - range); i < current; i++) {
        before.push(i);
      }
    }

    if (current < total) {
      for (
        let i = current + 1;
        i <= Math.min(total - 1, current + range);
        i++
      ) {
        after.push(i);
      }

      if (current + range < total - 1) after.push("ellipsis");

      after.push(total);
    }

    return { before, after };
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;

    const page = Number(inputValue());

    if (
      isNaN(page) ||
      page < 1 ||
      (props.totalPages && page > props.totalPages)
    ) {
      return;
    }

    if (page === props.currentPage) {
      setIsOpen(false);
      return;
    }

    props.onPageChange(page);
    setIsOpen(false);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest(`.${style.comboWrapper}`)) {
      setIsOpen(false);
    }
  };

  document.addEventListener("click", handleClickOutside);
  onCleanup(() => {
    document.removeEventListener("click", handleClickOutside);
  });

  return (
    <div class={style.paginationContainer}>
      {sidePages()?.before.map((item) =>
        item === "ellipsis" ? (
          <span class={style.ellipsis}>…</span>
        ) : (
          <button
            class={style.pageBtn}
            onClick={() => props.onPageChange(item)}
          >
            {item}
          </button>
        )
      )}

      <div class={style.comboWrapper}>
        <input
          type="text"
          class={style.paginationInput}
          value={inputValue()}
          onFocus={() => setIsOpen(true)}
          onInput={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />

        {isOpen() && (
          <div class={style.dropdown}>
            {filteredPages().length === 0 && (
              <div class={style.empty}>Sin resultados</div>
            )}

            {filteredPages().map((page) => {
              const isCurrent = page === props.currentPage;

              return (
                <button
                  class={style.dropdownItem}
                  disabled={isCurrent}
                  classList={{ [style.disabled]: isCurrent }}
                  onClick={() => {
                    if (!isCurrent) {
                      props.onPageChange(page);
                      setIsOpen(false);
                    }
                  }}
                >
                  {page}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sidePages()?.after.map((item) =>
        item === "ellipsis" ? (
          <span class={style.ellipsis}>…</span>
        ) : (
          <button
            class={style.pageBtn}
            onClick={() => props.onPageChange(item)}
          >
            {item}
          </button>
        )
      )}
    </div>
  );
};

export default Pagination;
