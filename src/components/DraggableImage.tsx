import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useImageContext } from '../context/ImageContext';
import { useExport } from '../hooks/useExport';
import type { ImageItem, DragMode, ResizeHandle } from '../types';
import {
  ClipboardDocumentIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpOnSquareIcon,
  ArrowDownOnSquareIcon,
} from '@heroicons/react/24/outline';
import CropIcon from './CropIcon';

interface DraggableImageProps {
  image: ImageItem;
  isSelected: boolean;
  dragMode: DragMode;
  onStartCrop?: (image: ImageItem) => void;
  onStartDownload?: (image: ImageItem) => void;
}

const DraggableImage: React.FC<DraggableImageProps> = ({
  image,
  isSelected,
  dragMode,
  onStartCrop,
  onStartDownload,
}) => {
  const { updateImage, selectImage, deleteImage, dispatch, reorderLayer, state } = useImageContext();

  const { copyImageToClipboard } = useExport();

  const imageRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // 状態管理
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);


  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    imgX: number;
    imgY: number;
  } | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    handle: ResizeHandle;
  } | null>(null);

  // 画像クリック処理
  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      selectImage(image.id);
    },
    [selectImage, image.id]
  );

  // ドラッグ開始
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // 左クリックのみ

      e.preventDefault();
      e.stopPropagation();

      selectImage(image.id);

      // フリーモードとグリッドスナップモードでドラッグ可能
      if (dragMode === 'free' || dragMode === 'grid-snap') {
        setIsDragging(true);
        setDragStart({
          x: e.clientX,
          y: e.clientY,
          imgX: image.x,
          imgY: image.y,
        });
      }
    },
    [selectImage, image.id, image.x, image.y, dragMode]
  );

  // キャンバスの境界を取得
  const getCanvasBounds = useCallback(() => {
    const canvas = document.getElementById('image-canvas');
    if (!canvas) return { width: window.innerWidth, height: window.innerHeight };
    
    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }, []);

  // グリッドスナップ関数
  const snapToGrid = useCallback((value: number, gridSize: number = 22) => {
    return Math.round(value / gridSize) * gridSize;
  }, []);

  // ホバー管理関数
  const handleImageMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleImageMouseLeave = useCallback(() => {
    // 常にタイマーをセット（ツールバーが制御する）
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 200); // 0.2秒遅延
  }, []);

  const handleToolbarMouseEnter = useCallback(() => {
    // ツールバーにホバーした際は常にタイマーをクリア
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleToolbarMouseLeave = useCallback(() => {
    // ツールバーを離れた際は常にタイマーをセット
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 200); // 0.2秒遅延
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // ドラッグ中
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && dragStart) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        
        const bounds = getCanvasBounds();
        let newX = dragStart.imgX + deltaX;
        let newY = dragStart.imgY + deltaY;

        // グリッドスナップモードの場合はスナップを適用
        if (dragMode === 'grid-snap') {
          newX = snapToGrid(newX);
          newY = snapToGrid(newY);
        }

        // 境界制限を適用
        const constrainedX = Math.max(0, Math.min(bounds.width - image.width, newX));
        const constrainedY = Math.max(0, Math.min(bounds.height - image.height, newY));

        updateImage(image.id, {
          x: constrainedX,
          y: constrainedY,
        });
      }

      if (isResizing && resizeStart) {
        handleResize(e);
      }
    },
    [
      isDragging,
      isResizing,
      dragStart,
      resizeStart,
      dragMode,
      image.id,
      image.width,
      image.height,
      updateImage,
      getCanvasBounds,
      snapToGrid,
    ]
  );

  // リサイズ処理
  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!resizeStart) return;

      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      let newX = image.x;
      let newY = image.y;

      const aspectRatio = image.originalWidth / image.originalHeight;
      const isAspectLocked = image.aspectRatioLocked && !e.shiftKey;
      const bounds = getCanvasBounds();

      switch (resizeStart.handle) {
        case 'se':
          newWidth = Math.max(50, resizeStart.width + deltaX);
          newHeight = Math.max(50, resizeStart.height + deltaY);
          break;
        case 'sw':
          newWidth = Math.max(50, resizeStart.width - deltaX);
          newHeight = Math.max(50, resizeStart.height + deltaY);
          newX = image.x + (resizeStart.width - newWidth);
          break;
        case 'ne':
          newWidth = Math.max(50, resizeStart.width + deltaX);
          newHeight = Math.max(50, resizeStart.height - deltaY);
          newY = image.y + (resizeStart.height - newHeight);
          break;
        case 'nw':
          newWidth = Math.max(50, resizeStart.width - deltaX);
          newHeight = Math.max(50, resizeStart.height - deltaY);
          newX = image.x + (resizeStart.width - newWidth);
          newY = image.y + (resizeStart.height - newHeight);
          break;
      }

      // アスペクト比を維持
      if (isAspectLocked) {
        if (resizeStart.handle === 'se' || resizeStart.handle === 'nw') {
          const ratio = Math.min(
            newWidth / resizeStart.width,
            newHeight / resizeStart.height
          );
          newWidth = resizeStart.width * ratio;
          newHeight = resizeStart.height * ratio;
        } else {
          newHeight = newWidth / aspectRatio;
        }
      }

      // 境界制限を適用
      newWidth = Math.min(newWidth, bounds.width - newX);
      newHeight = Math.min(newHeight, bounds.height - newY);
      newX = Math.max(0, Math.min(bounds.width - newWidth, newX));
      newY = Math.max(0, Math.min(bounds.height - newHeight, newY));

      // 最小サイズを確保
      newWidth = Math.max(50, newWidth);
      newHeight = Math.max(50, newHeight);

      // グリッドスナップモードの場合はスナップを適用
      if (dragMode === 'grid-snap') {
        const gridSize = 22;
        newX = snapToGrid(newX, gridSize);
        newY = snapToGrid(newY, gridSize);
        newWidth = snapToGrid(newWidth, gridSize);
        newHeight = snapToGrid(newHeight, gridSize);
      }

      updateImage(image.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    },
    [resizeStart, image, updateImage, getCanvasBounds, dragMode, snapToGrid]
  );

  // ドラッグ終了
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart) {
      // 実際に移動があったかチェック（最小移動距離3px以上）
      const deltaX = Math.abs(image.x - dragStart.imgX);
      const deltaY = Math.abs(image.y - dragStart.imgY);
      const hasActualMovement = deltaX > 3 || deltaY > 3;

      if (hasActualMovement) {
        // 履歴に追加
        dispatch({
          type: 'ADD_HISTORY_STEP',
          payload: {
            action: 'move-image',
            description: '画像を移動',
          },
        });
      }
    }

    if (isResizing && resizeStart) {
      // 実際にリサイズがあったかチェック（最小変更3px以上）
      const deltaWidth = Math.abs(image.width - resizeStart.width);
      const deltaHeight = Math.abs(image.height - resizeStart.height);
      const hasActualResize = deltaWidth > 3 || deltaHeight > 3;

      if (hasActualResize) {
        // 履歴に追加
        dispatch({
          type: 'ADD_HISTORY_STEP',
          payload: {
            action: 'resize-image',
            description: '画像をリサイズ',
          },
        });
      }
    }

    setIsDragging(false);
    setIsResizing(false);
    setDragStart(null);
    setResizeStart(null);
  }, [isDragging, isResizing, dragStart, resizeStart, image.x, image.y, image.width, image.height, dispatch]);

  // リサイズハンドルのマウスダウン
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();

      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: image.width,
        height: image.height,
        handle,
      });
    },
    [image.width, image.height]
  );

  // 右クリックメニュー
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      selectImage(image.id);
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [selectImage, image.id]
  );

  // マウスイベントリスナー
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isDragging ? 'grabbing' : 'nw-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // コンテキストメニューを閉じる
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // レイヤー操作関数
  const moveToFront = () => {
    const maxZIndex = Math.max(...state.images.map(img => img.zIndex));
    reorderLayer(image.id, maxZIndex + 1);
  };

  const moveForward = () => {
    const currentZIndex = image.zIndex;
    const higherImages = state.images.filter(img => img.zIndex > currentZIndex);
    if (higherImages.length > 0) {
      const nextZIndex = Math.min(...higherImages.map(img => img.zIndex));
      reorderLayer(image.id, nextZIndex + 0.5);
    }
  };

  const moveBackward = () => {
    const currentZIndex = image.zIndex;
    const lowerImages = state.images.filter(img => img.zIndex < currentZIndex);
    if (lowerImages.length > 0) {
      const prevZIndex = Math.max(...lowerImages.map(img => img.zIndex));
      reorderLayer(image.id, prevZIndex - 0.5);
    }
  };

  const moveToBack = () => {
    const minZIndex = Math.min(...state.images.map(img => img.zIndex));
    reorderLayer(image.id, minZIndex - 1);
  };

  // コンテキストメニューアクション
  const contextMenuActions = [
    {
      label: 'ダウンロード...',
      icon: ArrowDownTrayIcon,
      action: () => onStartDownload?.(image),
    },
    { separator: true },
    {
      label: '最前面に移動',
      icon: ArrowUpOnSquareIcon,
      action: moveToFront,
    },
    {
      label: '前面に移動',
      icon: ArrowUpIcon,
      action: moveForward,
    },
    {
      label: '背面に移動',
      icon: ArrowDownIcon,
      action: moveBackward,
    },
    {
      label: '最背面に移動',
      icon: ArrowDownOnSquareIcon,
      action: moveToBack,
    },
    { separator: true },
    {
      label: '削除',
      icon: TrashIcon,
      action: () => deleteImage(image.id),
      danger: true,
    },
  ];

  return (
    <>
      <div
        ref={imageRef}
        className={`absolute select-none transition-all duration-75 ${
          isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
        } ${isDragging ? 'z-50' : ''}`}
        style={{
          left: image.x,
          top: image.y,
          width: image.width,
          height: image.height,
          zIndex: image.zIndex,
          cursor:
            (dragMode === 'free' || dragMode === 'grid-snap') && !isResizing
              ? isDragging
                ? 'grabbing'
                : 'grab'
              : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleImageMouseEnter}
        onMouseLeave={handleImageMouseLeave}
        onContextMenu={handleContextMenu}
        onClick={handleImageClick}
        role="img"
        aria-label={`画像 ${image.id}`}
        tabIndex={0}
      >
        {/* 画像本体 */}
        <img
          ref={imgElementRef}
          src={image.src}
          alt={`画像 ${image.id}`}
          className="w-full h-full object-cover rounded shadow-lg"
          draggable={false}
          style={{ opacity: image.opacity ?? 1 }}
        />

        {/* ホバー時のツールバー */}
        {isHovered && !isDragging && !isResizing && !contextMenu && (
          <>
            {/* ツールバーと画像間のブリッジエリア（透明、ツールバーサイズに制限） */}
            <div 
              className="absolute -top-10 left-0 z-9"
              style={{ width: '144px', height: '40px' }}
              onMouseEnter={handleToolbarMouseEnter}
              onMouseLeave={handleToolbarMouseLeave}
            />
            
            <div 
              ref={toolbarRef}
              className="absolute -top-10 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg flex items-center px-2 py-1 space-x-1 z-10"
              data-toolbar="true"
              onMouseEnter={handleToolbarMouseEnter}
              onMouseLeave={handleToolbarMouseLeave}
            >
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Clipboard button clicked');
                copyImageToClipboard(image.id);
              }}
              className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="クリップボードにコピー"
            >
              <ClipboardDocumentIcon className="w-4 h-4" />
            </button>

            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Crop button clicked');
                onStartCrop?.(image);
              }}
              className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="トリミング"
            >
              <CropIcon className="w-4 h-4" />
            </button>

            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Aspect ratio button clicked');
                updateImage(image.id, {
                  aspectRatioLocked: !image.aspectRatioLocked,
                });
              }}
              className={`p-1 rounded transition-colors ${
                image.aspectRatioLocked
                  ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
              title={`アスペクト比${image.aspectRatioLocked ? 'ロック中' : 'ロック解除'}`}
            >
              {image.aspectRatioLocked ? (
                <LockClosedIcon className="w-4 h-4" />
              ) : (
                <LockOpenIcon className="w-4 h-4" />
              )}
            </button>

            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Delete button clicked');
                deleteImage(image.id);
              }}
              className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="削除"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
          </>
        )}

        {/* リサイズハンドル */}
        {isSelected && !isDragging && (
          <div className="absolute inset-0 pointer-events-none">
            {(['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map((handle) => (
              <button
                key={handle}
                className={`absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full pointer-events-auto transition-opacity hover:opacity-100 ${
                  isHovered || isResizing ? 'opacity-100' : 'opacity-0'
                } ${
                  handle === 'nw'
                    ? '-top-1.5 -left-1.5 cursor-nw-resize'
                    : handle === 'ne'
                      ? '-top-1.5 -right-1.5 cursor-ne-resize'
                      : handle === 'sw'
                        ? '-bottom-1.5 -left-1.5 cursor-sw-resize'
                        : '-bottom-1.5 -right-1.5 cursor-se-resize'
                }`}
                onMouseDown={(e) => handleResizeMouseDown(e, handle)}
                title={`${handle.toUpperCase()}角をドラッグしてリサイズ`}
                aria-label={`${handle}角リサイズハンドル`}
              />
            ))}
          </div>
        )}

        {/* リサイズ中のヘルプテキスト */}
        {isResizing && (
          <div className="absolute -bottom-8 left-0 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            Shiftキーでアスペクト比解除
          </div>
        )}
      </div>

      {/* コンテキストメニュー */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-50 min-w-48"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenuActions.map((item, index) =>
            item.separator ? (
              <div
                key={index}
                className="border-t border-gray-200 dark:border-gray-700 my-1"
              />
            ) : (
              <button
                key={index}
                onClick={() => {
                  item.action?.();
                  setContextMenu(null);
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${
                  item.danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                <span>{item.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </>
  );
};

export default DraggableImage;
