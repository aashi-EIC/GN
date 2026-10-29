import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

export function PageSizeMenu({
  id,
  anchorRef,
  options,
  value,
  onSelect,
  onClose,
}: {
  id: string;
  anchorRef: RefObject<HTMLDivElement | null>;
  options: number[];
  value: number;
  onSelect: (value: number) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 0 });
  const visible = position.maxHeight > 0;

  useLayoutEffect(() => {
    const updatePosition = (event?: Event) => {
      if (event?.target instanceof Node && menuRef.current?.contains(event.target)) return;
      const anchor = anchorRef.current;
      if (!anchor) return;
      let bounds = anchor.getBoundingClientRect();
      const messages = anchor.closest<HTMLElement>(".messages");
      const chatBounds = messages?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = Math.min(
        viewportTop + (viewport?.height ?? innerHeight),
        chatBounds?.bottom ?? innerHeight,
      );
      const viewportRight = viewportLeft + (viewport?.width ?? innerWidth);
      const width = menuRef.current?.offsetWidth ?? 96;
      const height = Math.min(
        200,
        Math.max(
          0,
          viewportBottom - Math.max(viewportTop, chatBounds?.top ?? 0) - bounds.height - 22,
        ),
      );
      // The chat reserves temporary space so the menu stays above the composer.
      if (messages && chatBounds && (!event || event.type === "resize")) {
        const overflow = bounds.bottom + 6 + height + 8 - viewportBottom;
        if (overflow > 0) {
          const scale = chatBounds.height / messages.offsetHeight || 1;
          messages.scrollTop += overflow / scale;
          bounds = anchor.getBoundingClientRect();
        }
      }
      const top = bounds.bottom + 6;
      setPosition({
        top,
        left: Math.max(viewportLeft + 8, Math.min(bounds.right - width, viewportRight - width - 8)),
        maxHeight: Math.max(0, Math.min(height, viewportBottom - top - 8)),
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!visible) return;
    const selected = menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    (selected ?? menuRef.current?.querySelector("button"))?.focus({ preventScroll: true });
    if (selected && menuRef.current) {
      menuRef.current.scrollTop = Math.max(
        0,
        selected.offsetTop - (menuRef.current.clientHeight - selected.offsetHeight) / 2,
      );
    }
  }, [visible]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !anchorRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      )
        onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      anchorRef.current?.querySelector<HTMLButtonElement>(".page-size-dropdown-toggle")?.focus({
        preventScroll: true,
      });
    };
    const closeOnPageScroll = (event: Event) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) onClose();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape, true);
    document.addEventListener("wheel", closeOnPageScroll, { capture: true, passive: true });
    document.addEventListener("touchmove", closeOnPageScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape, true);
      document.removeEventListener("wheel", closeOnPageScroll, true);
      document.removeEventListener("touchmove", closeOnPageScroll, true);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      className="page-size-options"
      role="listbox"
      aria-label="Rows per page"
      style={{ ...position, visibility: visible ? "visible" : "hidden" }}
      onKeyDown={(event) => {
        const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let next: number;
        if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
        else if (event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[next]?.focus();
      }}
    >
      {[...options, 0].map((option) => (
        <button
          key={option}
          type="button"
          role="option"
          aria-selected={value === option}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            onSelect(option);
            anchorRef.current
              ?.querySelector<HTMLButtonElement>(".page-size-dropdown-toggle")
              ?.focus({
                preventScroll: true,
              });
          }}
        >
          <span>{option || "All"}</span>
          {value === option && <Check size={12} aria-hidden="true" />}
        </button>
      ))}
    </div>,
    document.body,
  );
}
