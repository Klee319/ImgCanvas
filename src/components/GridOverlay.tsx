import React from 'react';

interface GridOverlayProps {
  visible: boolean;
  gridSize?: number;
  canvasWidth: number;
  canvasHeight: number;
}

const GridOverlay: React.FC<GridOverlayProps> = ({
  visible,
  gridSize = 22,
  canvasWidth,
  canvasHeight,
}) => {
  if (!visible) return null;

  // グリッドライン生成
  const verticalLines = [];
  const horizontalLines = [];

  // 垂直線
  for (let x = 0; x <= canvasWidth; x += gridSize) {
    verticalLines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={canvasHeight}
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.15"
      />
    );
  }

  // 水平線
  for (let y = 0; y <= canvasHeight; y += gridSize) {
    horizontalLines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={canvasWidth}
        y2={y}
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.15"
      />
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <svg
        width={canvasWidth}
        height={canvasHeight}
        className="w-full h-full text-slate-600 dark:text-slate-400"
      >
        {verticalLines}
        {horizontalLines}
      </svg>
    </div>
  );
};

export default GridOverlay; 