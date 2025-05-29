import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { useImageContext } from '../context/ImageContext';
import { ImageItem } from '../types';

interface LayerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const LayerSidebar: React.FC<LayerSidebarProps> = ({ isOpen, onClose }) => {
  const {
    state,
    toggleLayerVisibility,
    reorderLayer,
    selectImage,
  } = useImageContext();
  const { images, selectedImageId } = state;
  
  // ドラッグ状態管理
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // z-index順でソート（高い順）
  const sortedImages = [...images].sort((a, b) => b.zIndex - a.zIndex);

  const handleToggleVisibility = (id: string) => {
    toggleLayerVisibility(id);
  };

  const handleSelectImage = (id: string) => {
    selectImage(id);
  };

  // ドラッグ&ドロップイベントハンドラー（改良版）
  const handleDragStart = (e: React.DragEvent, imageId: string) => {
    setDraggedImageId(imageId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', imageId);
    // ドラッグイメージを設定（透明度を上げるため）
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '0.5';
    }
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(targetIndex);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // 子要素へのドラッグを除外
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (!draggedImageId) return;
    
    const draggedImageIndex = sortedImages.findIndex(img => img.id === draggedImageId);
    
    if (draggedImageIndex === -1 || draggedImageIndex === targetIndex) {
      // 状態をリセット
      setDraggedImageId(null);
      setDragOverIndex(null);
      return;
    }

    // ターゲット画像のzIndexを取得
    const targetImage = sortedImages[targetIndex];
    const targetZIndex = targetImage.zIndex;
    
    reorderLayer(draggedImageId, targetZIndex);
    
    // 状態をリセット
    setDraggedImageId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // ドラッグ要素のスタイルをリセット
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '';
    }
    setDraggedImageId(null);
    setDragOverIndex(null);
  };

  const generateThumbnail = (image: ImageItem) => {
    return (
      <div
        className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded border overflow-hidden flex-shrink-0"
        style={{
          backgroundImage: `url(${image.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-25 z-40"
            onClick={onClose}
          />

          {/* サイドバー */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col"
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                レイヤー管理
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="レイヤーサイドバーを閉じる"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* 操作説明 */}
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                ドラッグ&ドロップでレイヤーの順序を変更できます
              </p>
            </div>

            {/* レイヤーリスト */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sortedImages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <p>画像がありません</p>
                  <p className="text-sm mt-1">
                    Ctrl+V で画像を貼り付けてください
                  </p>
                </div>
              ) : (
                sortedImages.map((image, index) => (
                  <div
                    key={image.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, image.id)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={(e) => handleDragEnd(e)}
                    className={`
                      p-3 rounded-lg border transition-all duration-200 select-none
                      ${
                        selectedImageId === image.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                      ${!image.visible ? 'opacity-50' : ''}
                      ${dragOverIndex === index && draggedImageId !== image.id ? 
                        'border-2 border-dashed border-blue-400 bg-blue-100 dark:bg-blue-800/30 transform scale-105' : 
                        'cursor-grab active:cursor-grabbing'
                      }
                      ${draggedImageId === image.id ? 'shadow-2xl border-blue-500 z-10 opacity-30 transform scale-95' : ''}
                    `}
                    onClick={() => handleSelectImage(image.id)}
                  >
                    <div className="flex items-center space-x-3">
                      {/* ドラッグハンドル */}
                      <div className="flex-shrink-0">
                        <Bars3Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </div>

                      {/* サムネイル */}
                      {generateThumbnail(image)}

                      {/* 情報 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            レイヤー {sortedImages.length - index}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            z: {image.zIndex}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {Math.round(image.width)} × {Math.round(image.height)} px
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ({Math.round(image.x)}, {Math.round(image.y)})
                        </div>
                      </div>

                      {/* 可視性切替 */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleVisibility(image.id);
                          }}
                          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label={
                            image.visible ? '非表示にする' : '表示する'
                          }
                        >
                          {image.visible ? (
                            <EyeIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          ) : (
                            <EyeSlashIcon className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ドロップインジケーター */}
                    {dragOverIndex === index && draggedImageId !== image.id && (
                      <div className="absolute inset-x-0 top-0 h-1 bg-blue-500 rounded-full opacity-100" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* フッター */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
                <p>Lキー: サイドバー切替</p>
                <p>ドラッグ&ドロップ: レイヤー順序変更</p>
                <p>目のアイコン: 表示/非表示切替</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LayerSidebar;
 