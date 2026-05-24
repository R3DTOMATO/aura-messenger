import React from "react";

interface Shape {
  id: number;
  type: "circle" | "triangle" | "square" | "diamond" | "dot" | "line" | "zigzag";
  color: string;
  size: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  animClass?: string;
}

const COLORS = [
  "#A8E6CF", // mint
  "#DDA0DD", // lilac/plum
  "#FFE066", // yellow
  "#FFB3BA", // pink
  "#B5D5FF", // sky blue
  "#FFD4A3", // peach accent
  "#C3B1E1", // lavender
];

const SHAPES: Shape[] = [
  { id: 1, type: "circle", color: COLORS[0], size: 48, x: 5, y: 8, rotation: 0, opacity: 0.8, animClass: "animate-float" },
  { id: 2, type: "triangle", color: COLORS[1], size: 36, x: 88, y: 12, rotation: 15, opacity: 0.75 },
  { id: 3, type: "square", color: COLORS[2], size: 28, x: 15, y: 75, rotation: 20, opacity: 0.7, animClass: "animate-spin-slow" },
  { id: 4, type: "diamond", color: COLORS[3], size: 22, x: 92, y: 65, rotation: 45, opacity: 0.8 },
  { id: 5, type: "circle", color: COLORS[4], size: 18, x: 50, y: 5, rotation: 0, opacity: 0.6, animClass: "animate-float" },
  { id: 6, type: "dot", color: "#1a1a1a", size: 8, x: 25, y: 20, rotation: 0, opacity: 0.5 },
  { id: 7, type: "dot", color: "#1a1a1a", size: 6, x: 75, y: 30, rotation: 0, opacity: 0.4 },
  { id: 8, type: "dot", color: "#1a1a1a", size: 10, x: 60, y: 80, rotation: 0, opacity: 0.45 },
  { id: 9, type: "triangle", color: COLORS[2], size: 30, x: 3, y: 45, rotation: -10, opacity: 0.65 },
  { id: 10, type: "square", color: COLORS[5], size: 20, x: 80, y: 85, rotation: 35, opacity: 0.7 },
  { id: 11, type: "circle", color: COLORS[6], size: 14, x: 40, y: 90, rotation: 0, opacity: 0.55, animClass: "animate-float" },
  { id: 12, type: "diamond", color: COLORS[0], size: 16, x: 70, y: 10, rotation: 0, opacity: 0.65 },
  { id: 13, type: "line", color: "#1a1a1a", size: 40, x: 35, y: 15, rotation: -30, opacity: 0.25 },
  { id: 14, type: "line", color: "#1a1a1a", size: 30, x: 85, y: 50, rotation: 60, opacity: 0.2 },
  { id: 15, type: "dot", color: COLORS[3], size: 12, x: 10, y: 60, rotation: 0, opacity: 0.7 },
  { id: 16, type: "circle", color: COLORS[2], size: 8, x: 95, y: 35, rotation: 0, opacity: 0.5 },
  { id: 17, type: "triangle", color: COLORS[4], size: 20, x: 55, y: 95, rotation: 180, opacity: 0.6 },
  { id: 18, type: "square", color: COLORS[1], size: 14, x: 22, y: 38, rotation: 15, opacity: 0.55 },
];

function ShapeEl({ shape }: { shape: Shape }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${shape.x}%`,
    top: `${shape.y}%`,
    opacity: shape.opacity,
    transform: `rotate(${shape.rotation}deg)`,
    pointerEvents: "none",
    userSelect: "none",
  };

  if (shape.type === "circle") {
    return (
      <div
        className={shape.animClass}
        style={{
          ...style,
          width: shape.size,
          height: shape.size,
          borderRadius: "50%",
          background: shape.color,
          border: "2.5px solid #1a1a1a",
        }}
      />
    );
  }

  if (shape.type === "square") {
    return (
      <div
        className={shape.animClass}
        style={{
          ...style,
          width: shape.size,
          height: shape.size,
          background: shape.color,
          border: "2.5px solid #1a1a1a",
        }}
      />
    );
  }

  if (shape.type === "diamond") {
    return (
      <div
        style={{
          ...style,
          width: shape.size,
          height: shape.size,
          background: shape.color,
          border: "2.5px solid #1a1a1a",
          transform: `rotate(${shape.rotation + 45}deg)`,
        }}
      />
    );
  }

  if (shape.type === "triangle") {
    return (
      <div
        style={{
          ...style,
          width: 0,
          height: 0,
          background: "transparent",
          border: "none",
          borderLeft: `${shape.size / 2}px solid transparent`,
          borderRight: `${shape.size / 2}px solid transparent`,
          borderBottom: `${shape.size * 0.87}px solid ${shape.color}`,
          filter: `drop-shadow(0 0 0 2px #1a1a1a)`,
        }}
      />
    );
  }

  if (shape.type === "dot") {
    return (
      <div
        style={{
          ...style,
          width: shape.size,
          height: shape.size,
          borderRadius: "50%",
          background: shape.color,
        }}
      />
    );
  }

  if (shape.type === "line") {
    return (
      <div
        style={{
          ...style,
          width: shape.size,
          height: 3,
          background: shape.color,
          borderRadius: 2,
        }}
      />
    );
  }

  return null;
}

export default function MemphisBackground({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ zIndex: 0 }}
    >
      {SHAPES.map((shape) => (
        <ShapeEl key={shape.id} shape={shape} />
      ))}
    </div>
  );
}
