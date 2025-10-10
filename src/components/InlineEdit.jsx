import { useState, useEffect, useRef } from "react";

export function InlineEdit({ initialValue, onSave, onCancel, className = "" }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleSave = () => {
    if (
      value.trim() &&
      value.trim().toLowerCase() !== initialValue.toLowerCase()
    ) {
      onSave(value.trim());
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      className={`bg-gray-100 dark:bg-gray-700 border border-blue-500 rounded-md outline-none ${className}`}
    />
  );
}
