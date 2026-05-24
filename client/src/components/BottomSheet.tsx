import React, { useEffect } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
}

export default function BottomSheet({ open, onClose, title, children, maxWidth = 480 }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="bottom-sheet"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bottom-sheet-panel" style={{ maxWidth }}>
        {/* Drag handle */}
        <div
          aria-hidden
          style={{
            width: 38,
            height: 4,
            background: "var(--gray-300)",
            borderRadius: 2,
            margin: "2px auto 12px",
          }}
        />
        {title && (
          <div className="flex items-center justify-between mb-3">
            <h3
              className="font-display"
              style={{ fontSize: "1.1rem", fontWeight: 800 }}
            >
              {title}
            </h3>
            <button
              onClick={onClose}
              className="icon-btn"
              aria-label="닫기"
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
