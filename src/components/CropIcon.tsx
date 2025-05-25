import React from 'react';

interface CropIconProps {
  className?: string;
}

const CropIcon: React.FC<CropIconProps> = ({ className }) => {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      {/* メインの四角形 */}
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 左上の角 */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 7L4 4M7 7V4M7 7H4"
      />
      {/* 右下の角 */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 17l3 3M17 17v3M17 17h3"
      />
    </svg>
  );
};

export default CropIcon; 