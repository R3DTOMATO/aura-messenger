import React from "react";

const AVATAR_COLORS = [
  { bg: "#A8E6CF", text: "#1a5c3a" },
  { bg: "#DDA0DD", text: "#5a1a7a" },
  { bg: "#FFE066", text: "#7a5a00" },
  { bg: "#FFB3BA", text: "#7a1a2a" },
  { bg: "#B5D5FF", text: "#1a3a7a" },
  { bg: "#C3B1E1", text: "#3a1a6a" },
  { bg: "#FFD4A3", text: "#7a3a00" },
  { bg: "#A0D8EF", text: "#0d3a4a" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  // For Korean / single-word names just use the first 1-2 chars
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isOnline?: boolean;
  showStatus?: boolean;
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: { container: 22, font: "0.55rem", dot: 7, border: 1.5 },
  sm: { container: 30, font: "0.65rem", dot: 8, border: 2 },
  md: { container: 42, font: "0.9rem", dot: 11, border: 2 },
  lg: { container: 56, font: "1.1rem", dot: 12, border: 2 },
  xl: { container: 84, font: "1.6rem", dot: 14, border: 2.5 },
};

export default function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  isOnline = false,
  showStatus = false,
  className = "",
  onClick,
}: UserAvatarProps) {
  const { container, font, dot, border } = SIZE_MAP[size];
  const color = getAvatarColor(name || "?");
  const initials = getInitials(name);

  return (
    <div
      className={`relative flex-shrink-0 ${className} ${onClick ? "cursor-pointer" : ""}`}
      style={{ width: container, height: container }}
      onClick={onClick}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          style={{
            width: container,
            height: container,
            borderRadius: "32%",
            objectFit: "cover",
            border: `${border}px solid var(--border)`,
          }}
        />
      ) : (
        <div
          style={{
            width: container,
            height: container,
            borderRadius: "32%",
            background: color.bg,
            border: `${border}px solid var(--border)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: font,
            fontWeight: 800,
            color: color.text,
            fontFamily: "Pretendard, Space Grotesk, sans-serif",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {initials}
        </div>
      )}
      {showStatus && (
        <div
          className={isOnline ? "online-dot" : "offline-dot"}
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: dot,
            height: dot,
          }}
        />
      )}
    </div>
  );
}
