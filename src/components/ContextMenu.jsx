import { useEffect, useRef } from "react";

export function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[150px]"
      style={{ top: y, left: x }}
    >
      {items.map((item, index) => {
        if (item.isSeparator) {
          return (
            <div
              key={`sep-${index}`}
              className="border-t border-gray-200 dark:border-gray-700 my-1"
            />
          );
        }
        return (
          <button
            key={item.label}
            onClick={() => {
              item.action();
              onClose();
            }}
            className={`w-full text-left px-4 py-1.5 text-sm ${
              item.isDanger
                ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
