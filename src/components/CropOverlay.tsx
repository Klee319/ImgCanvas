import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useImageContext } from '../context/ImageContext';
import { ImageItem } from '../types';

interface CropOverlayProps {
  image: ImageItem;
  onClose: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CropOverlay: React.FC<CropOverlayProps> = ({ image, onClose }) => {
  const { dispatch } = useImageContext();
  const [cropArea, setCropArea] = useState<CropArea>({
    x: 0,
    y: 0,
    width: Math.min(image.width * 0.8, 300),
    height: Math.min(image.height * 0.8, 300),
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 画像の表示サイズを計算
  const maxDisplayWidth = Math.min(window.innerWidth * 0.8, 800);
  const maxDisplayHeight = Math.min(window.innerHeight * 0.8, 600);
  const aspectRatio = image.width / image.height;

  let displayWidth = maxDisplayWidth;
  let displayHeight = maxDisplayWidth / aspectRatio;

  if (displayHeight > maxDisplayHeight) {
    displayHeight = maxDisplayHeight;
    displayWidth = maxDisplayHeight * aspectRatio;
  }

  const scaleX = displayWidth / image.width;
  const scaleY = displayHeight / image.height;

  // 座標変換関数（境界制限を改善）
  const screenToImage = useCallback(
    (screenX: number, screenY: number) => {
      if (!imageRef.current) return { x: 0, y: 0 };
      
      const rect = imageRef.current.getBoundingClientRect();
      const relativeX = screenX - rect.left;
      const relativeY = screenY - rect.top;
      
      return {
        x: Math.max(0, Math.min(relativeX / scaleX, image.width)),
        y: Math.max(0, Math.min(relativeY / scaleY, image.height)),
      };
    },
    [scaleX, scaleY, image.width, image.height]
  );

  // 改良されたマウスダウンハンドラー
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!imageRef.current) return;

      const imageCoords = screenToImage(e.clientX, e.clientY);
      
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });

      setCropArea({
        x: imageCoords.x,
        y: imageCoords.y,
        width: 0,
        height: 0,
      });
    },
    [screenToImage]
  );

  // 改良されたマウス移動ハンドラー（グローバル座標を使用）
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !imageRef.current) return;

      const startImageCoords = screenToImage(dragStart.x, dragStart.y);
      const currentImageCoords = screenToImage(e.clientX, e.clientY);

      const newCropArea = {
        x: Math.max(0, Math.min(startImageCoords.x, currentImageCoords.x)),
        y: Math.max(0, Math.min(startImageCoords.y, currentImageCoords.y)),
        width: Math.abs(currentImageCoords.x - startImageCoords.x),
        height: Math.abs(currentImageCoords.y - startImageCoords.y),
      };

      // 画像境界内に厳密に制限
      newCropArea.x = Math.max(0, Math.min(newCropArea.x, image.width));
      newCropArea.y = Math.max(0, Math.min(newCropArea.y, image.height));
      newCropArea.width = Math.min(newCropArea.width, image.width - newCropArea.x);
      newCropArea.height = Math.min(newCropArea.height, image.height - newCropArea.y);

      setCropArea(newCropArea);
    },
    [isDragging, dragStart, screenToImage, image.width, image.height]
  );

  // 改良されたマウスアップハンドラー
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // グローバルマウスイベントリスナーの設定
  useEffect(() => {
    if (isDragging) {
      // グローバルイベントリスナーを追加してドラッグを継続
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // カーソルを固定
      document.body.style.cursor = 'crosshair';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 数値入力ハンドラー
  const handleInputChange = (field: keyof CropArea, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setCropArea((prev) => {
      const newArea = { ...prev, [field]: numValue };

      // 境界チェック
      if (field === 'x' || field === 'width') {
        newArea.x = Math.min(newArea.x, image.width - 1);
        newArea.width = Math.min(newArea.width, image.width - newArea.x);
      }
      if (field === 'y' || field === 'height') {
        newArea.y = Math.min(newArea.y, image.height - 1);
        newArea.height = Math.min(newArea.height, image.height - newArea.y);
      }

      return newArea;
    });
  };

  // トリミング適用
  const handleApplyCrop = async () => {
    if (cropArea.width <= 0 || cropArea.height <= 0) return;

    setIsProcessing(true);

    try {
      // Canvas でトリミング処理
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = cropArea.width;
      canvas.height = cropArea.height;

      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(
            img,
            cropArea.x,
            cropArea.y,
            cropArea.width,
            cropArea.height,
            0,
            0,
            cropArea.width,
            cropArea.height
          );
          resolve();
        };
        img.onerror = reject;
        img.src = image.src;
      });

      const croppedDataUrl = canvas.toDataURL('image/png');

      // 画像を更新
      dispatch({
        type: 'UPDATE_IMAGE',
        payload: {
          id: image.id,
          updates: {
            src: croppedDataUrl,
            width: cropArea.width,
            height: cropArea.height,
            originalWidth: cropArea.width,
            originalHeight: cropArea.height,
          },
        },
      });

      // 履歴ステップを追加（トリミング処理として記録）
      dispatch({
        type: 'ADD_HISTORY_STEP',
        payload: {
          action: 'crop-image',
          description: '画像をトリミング',
        },
      });

      console.info('✅ トリミングが正常に完了しました', {
        originalSize: `${image.width}×${image.height}`,
        croppedSize: `${cropArea.width}×${cropArea.height}`,
        cropArea: `(${Math.round(cropArea.x)}, ${Math.round(cropArea.y)})`
      });

      onClose();
    } catch (error) {
      console.error('Crop failed:', error);
      alert('トリミングに失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !isProcessing) {
        handleApplyCrop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isProcessing]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              画像をトリミング
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="トリミングをキャンセル"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* 画像プレビュー */}
            <div className="flex-1 p-4">
              <div className="relative inline-block" ref={containerRef}>
                <img
                  ref={imageRef}
                  src={image.src}
                  alt="Crop preview"
                  className="max-w-full max-h-full object-contain cursor-crosshair select-none"
                  style={{
                    width: displayWidth,
                    height: displayHeight,
                  }}
                  onMouseDown={handleMouseDown}
                  draggable={false}
                />

                {/* 選択範囲オーバーレイ */}
                {cropArea.width > 0 && cropArea.height > 0 && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
                    style={{
                      left: cropArea.x * scaleX,
                      top: cropArea.y * scaleY,
                      width: cropArea.width * scaleX,
                      height: cropArea.height * scaleY,
                    }}
                  >
                    {/* 選択範囲の情報表示 */}
                    <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
                    </div>
                    
                    {/* コーナーハンドル（視覚的なヒント） */}
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 border border-white rounded-full"></div>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 border border-white rounded-full"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 border border-white rounded-full"></div>
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 border border-white rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            {/* コントロールパネル */}
            <div className="w-full lg:w-80 p-4 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    トリミング範囲
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        X座標
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={image.width - 1}
                        value={Math.round(cropArea.x)}
                        onChange={(e) => handleInputChange('x', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Y座標
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={image.height - 1}
                        value={Math.round(cropArea.y)}
                        onChange={(e) => handleInputChange('y', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        幅
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={image.width - cropArea.x}
                        value={Math.round(cropArea.width)}
                        onChange={(e) =>
                          handleInputChange('width', e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        高さ
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={image.height - cropArea.y}
                        value={Math.round(cropArea.height)}
                        onChange={(e) =>
                          handleInputChange('height', e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    元画像情報
                  </h4>
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    <p>
                      サイズ: {image.width} × {image.height}px
                    </p>
                    <p>
                      選択範囲: {Math.round(cropArea.width)} ×{' '}
                      {Math.round(cropArea.height)}px
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    <p>• ドラッグして範囲を選択</p>
                    <p>• 数値入力で精密調整</p>
                    <p>• Enter: 適用 / Esc: キャンセル</p>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleApplyCrop}
                      disabled={
                        isProcessing ||
                        cropArea.width <= 0 ||
                        cropArea.height <= 0
                      }
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors"
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckIcon className="w-4 h-4 mr-1" />
                          適用
                        </>
                      )}
                    </button>
                    <button
                      onClick={onClose}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-medium rounded transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4 mr-1" />
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CropOverlay;
