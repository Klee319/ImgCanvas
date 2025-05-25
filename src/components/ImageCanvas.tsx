import React, { useCallback, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { useImageContext } from '../context/ImageContext';
import { usePasteHandler } from '../hooks/usePasteHandler';
import DraggableImage from './DraggableImage';
import GridOverlay from './GridOverlay';
import { ImageItem } from '../types';

interface ImageCanvasProps {
  onStartCrop?: (image: ImageItem) => void;
  onStartDownload?: (image: ImageItem) => void;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
  onStartCrop,
  onStartDownload,
}) => {
  const { state, selectImage, updateImage, dispatch } = useImageContext();
  const { handleFileDrop } = usePasteHandler();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });

  // キャンバスサイズの測定
  useLayoutEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // グリッドモード時のキーボード移動
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // グリッドスナップモードでのみ動作
      if (state.dragMode !== 'grid-snap' || !state.selectedImageId) return;

      // フォーカスがテキスト入力フィールドにある場合はスキップ
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const selectedImage = state.images.find(img => img.id === state.selectedImageId);
      if (!selectedImage) return;

      const gridSize = 22;
      const moveDistance = e.shiftKey ? gridSize * 2 : gridSize; // Shift+矢印で2グリッド分
      let newX = selectedImage.x;
      let newY = selectedImage.y;
      let moved = false;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          newX = Math.max(0, selectedImage.x - moveDistance);
          moved = true;
          break;
        case 'ArrowRight':
          e.preventDefault();
          newX = Math.min(canvasDimensions.width - selectedImage.width, selectedImage.x + moveDistance);
          moved = true;
          break;
        case 'ArrowUp':
          e.preventDefault();
          newY = Math.max(0, selectedImage.y - moveDistance);
          moved = true;
          break;
        case 'ArrowDown':
          e.preventDefault();
          newY = Math.min(canvasDimensions.height - selectedImage.height, selectedImage.y + moveDistance);
          moved = true;
          break;
        default:
          return;
      }

      if (moved) {
        // グリッドにスナップ
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;

        updateImage(state.selectedImageId, { x: newX, y: newY });
        
        // 履歴に追加
        dispatch({
          type: 'ADD_HISTORY_STEP',
          payload: {
            action: 'move-image',
            description: '画像をグリッドで移動',
          },
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.dragMode, state.selectedImageId, state.images, canvasDimensions, updateImage, dispatch]);

  // ドラッグオーバーの処理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // キャンバス要素から完全に出た場合のみドラッグオーバー状態を解除
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const isOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;

      if (isOutside) {
        setIsDragOver(false);
      }
    }
  }, []);

  // ファイルドロップの処理
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await handleFileDrop(files);
      }
    },
    [handleFileDrop]
  );

  // キャンバス背景のクリック処理（選択解除）
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // 画像以外の部分をクリックした場合、選択を解除
      if (e.target === e.currentTarget) {
        selectImage(null);
      }
    },
    [selectImage]
  );

  // z-index順にソートされた可視画像
  const sortedVisibleImages = state.images
    .filter((img) => img.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-800">
      {/* メインキャンバスエリア */}
      <div
        ref={canvasRef}
        id="image-canvas"
        className={`absolute inset-0 overflow-auto transition-colors duration-200 ${
          isDragOver 
            ? 'bg-blue-100 dark:bg-blue-900/30' 
            : 'bg-slate-100 dark:bg-slate-800'
        }`}
        onClick={handleCanvasClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="application"
        aria-label="画像編集キャンバス"
      >
        {/* グリッドオーバーレイ */}
        <GridOverlay
          visible={state.dragMode === 'grid-snap'}
          gridSize={22}
          canvasWidth={canvasDimensions.width}
          canvasHeight={canvasDimensions.height}
        />

        {/* ドラッグオーバー時のオーバーレイ */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white dark:bg-slate-700 rounded-xl p-10 shadow-lg border-2 border-dashed border-blue-400 dark:border-blue-500">
              <div className="text-center">
                <div className="text-5xl mb-4">📁</div>
                <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  ファイルをドロップして追加
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  画像ファイルをここにドロップしてください
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 画像要素の描画 */}
        {sortedVisibleImages.map((image) => (
          <DraggableImage
            key={image.id}
            image={image}
            isSelected={state.selectedImageId === image.id}
            dragMode={state.dragMode}
            onStartCrop={onStartCrop}
            onStartDownload={onStartDownload}
          />
        ))}
      </div>

      {/* キャンバスが空の場合のヘルプメッセージ */}
      {state.images.length === 0 && !isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center p-8 max-w-md opacity-70">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-2xl font-bold text-slate-500 dark:text-slate-400 mb-4">
              キャンバスが空です
            </h2>
            <div className="space-y-2 text-slate-400 dark:text-slate-500">
              <p>画像を追加する方法：</p>
              <ul className="text-sm space-y-1">
                <li>
                  • <strong>Ctrl+V</strong> (Mac: ⌘V)
                  でクリップボードから貼り付け
                </li>
                <li>• 画像ファイルをドラッグ&ドロップ</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* アクセシビリティ用の非表示テキスト */}
      <div className="sr-only">
        <p>
          画像編集キャンバス。画像をドラッグして移動、リサイズハンドルでサイズ変更、
          右クリックでコンテキストメニューを表示できます。
        </p>
        <p>
          キーボードショートカット: Ctrl+V で貼り付け、L
          でレイヤーサイドバー表示、 Ctrl+Z
          で元に戻す、矢印キーで選択画像を移動。
        </p>
      </div>
    </div>
  );
};

export default ImageCanvas;
