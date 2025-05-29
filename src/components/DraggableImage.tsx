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
  
  // パフォーマンス最適化用のrefs
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingUpdateRef = useRef<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | null>(null);
  const canvasBoundsRef = useRef<{ width: number; height: number } | null>(null);
  
  // Windows環境検出
  const isWindows = useRef<boolean>(
    typeof navigator !== 'undefined' && 
    navigator.userAgent.toLowerCase().includes('windows')
  );
  
  // Windows向け最適化設定
  const windowsOptimization = useRef<{
    targetFrameTime: number; // Windows向けの固定フレームレート
    useSimplifiedResize: boolean; // リサイズ計算の簡素化
    bypassComplexCalculations: boolean; // 複雑な計算のバイパス
  }>({
    targetFrameTime: isWindows.current ? 33.33 : 16.67, // Windows: 30fps, Others: 60fps
    useSimplifiedResize: isWindows.current,
    bypassComplexCalculations: isWindows.current
  });

  // 状態管理
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false); // Transform終了後の遷移状態
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
    imgX: number;
    imgY: number;
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

  // キャンバスの境界を取得（キャッシュ機能付き）
  const getCanvasBounds = useCallback(() => {
    if (canvasBoundsRef.current) {
      return canvasBoundsRef.current;
    }
    
    const canvas = document.getElementById('image-canvas');
    if (!canvas) {
      const bounds = { width: window.innerWidth, height: window.innerHeight };
      canvasBoundsRef.current = bounds;
      return bounds;
    }
    
    const rect = canvas.getBoundingClientRect();
    // 選択フレーム（ring-offset-2）とパディングを考慮して安全マージンを設定
    const safetyMargin = 8; // ring-offset-2 (4px) + 余裕 (4px)
    const bounds = {
      width: rect.width - safetyMargin,
      height: rect.height - safetyMargin,
    };
    canvasBoundsRef.current = bounds;
    return bounds;
  }, []);

  // キャンバス境界のキャッシュをクリア（リサイズ時など）
  useEffect(() => {
    const handleResize = () => {
      canvasBoundsRef.current = null;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // グリッドスナップ関数
  const snapToGrid = useCallback((value: number, gridSize: number = 22) => {
    return Math.round(value / gridSize) * gridSize;
  }, []);

  // 軽量グリッドスナップ（移動中用）- より大きなグリッドで高速化
  const lightSnapToGrid = useCallback((value: number, gridSize: number = 44) => {
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
      // requestAnimationFrameのクリーンアップ
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Windows向け最適化されたupdate関数
  const optimizedUpdateImage = useCallback((updates: Partial<ImageItem>) => {
    // Windows環境でのフリーモードリサイズ中は特別な処理
    if (isWindows.current && isResizing && dragMode === 'free') {
      // 即座に更新、バッチ処理なし
      updateImage(image.id, updates);
      return;
    }

    // Windows環境では即座に更新（requestAnimationFrameをバイパス）
    if (isWindows.current && isResizing) {
      updateImage(image.id, updates);
      return;
    }

    // 待機中の更新を蓄積
    pendingUpdateRef.current = {
      ...pendingUpdateRef.current,
      ...updates,
    };

    // 既にrequestAnimationFrameが予約されている場合は何もしない
    if (rafIdRef.current !== null) {
      return;
    }

    rafIdRef.current = requestAnimationFrame(() => {
      const now = performance.now();
      const targetFrameTime = windowsOptimization.current.targetFrameTime;
      
      // フレームレート制限（Windowsでは緩和）
      if (now - lastUpdateTimeRef.current >= targetFrameTime || isWindows.current) {
        if (pendingUpdateRef.current) {
          updateImage(image.id, pendingUpdateRef.current);
          pendingUpdateRef.current = null;
          lastUpdateTimeRef.current = now;
        }
      } else {
        // まだ間隔が足りない場合は再度予約
        rafIdRef.current = requestAnimationFrame(() => {
          if (pendingUpdateRef.current) {
            updateImage(image.id, pendingUpdateRef.current);
            pendingUpdateRef.current = null;
            lastUpdateTimeRef.current = performance.now();
          }
          rafIdRef.current = null;
        });
        return;
      }
      
      rafIdRef.current = null;
    });
  }, [updateImage, image.id, isResizing, dragMode]);

  // ドラッグ中
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && dragStart) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        
        const bounds = getCanvasBounds();
        let newX = dragStart.imgX + deltaX;
        let newY = dragStart.imgY + deltaY;

        // グリッドモードの場合は移動中も軽量スナップを適用
        if (dragMode === 'grid-snap') {
          newX = lightSnapToGrid(newX);
          newY = lightSnapToGrid(newY);
        }

        // 境界制限を適用
        const constrainedX = Math.max(0, Math.min(bounds.width - image.width, newX));
        const constrainedY = Math.max(0, Math.min(bounds.height - image.height, newY));

        // どちらのモードでも最適化されたupdate関数を使用
        optimizedUpdateImage({
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
      optimizedUpdateImage,
      getCanvasBounds,
      lightSnapToGrid,
    ]
  );

  // Windows向けに最適化されたリサイズ処理
  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!resizeStart) return;

      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      // リサイズ開始時の値を基準にする
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      let newX = resizeStart.imgX; // 開始時のX座標を使用
      let newY = resizeStart.imgY; // 開始時のY座標を使用

      // Windows環境でのフリーモード専用の超軽量処理
      if (isWindows.current && dragMode === 'free') {
        // 最低限のリサイズ計算のみ、他の処理は一切省略
        switch (resizeStart.handle) {
          case 'se': // 右下角
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            break;
          case 'sw': // 左下角
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            newX = resizeStart.imgX + (resizeStart.width - newWidth);
            break;
          case 'ne': // 右上角
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newY = resizeStart.imgY + (resizeStart.height - newHeight);
            break;
          case 'nw': // 左上角
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newX = resizeStart.imgX + (resizeStart.width - newWidth);
            newY = resizeStart.imgY + (resizeStart.height - newHeight);
            break;
        }

        // アスペクト比維持（超簡素版）
        if (image.aspectRatioLocked && !e.shiftKey) {
          const aspectRatio = image.originalWidth / image.originalHeight;
          const currentRatio = newWidth / newHeight;
          if (currentRatio > aspectRatio) {
            newWidth = newHeight * aspectRatio;
          } else {
            newHeight = newWidth / aspectRatio;
          }
        }

        // 最低限の境界制限のみ（Canvas境界取得も省略）
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(50, newHeight);

        // 最適化されたupdate関数を使用
        optimizedUpdateImage({
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        });

        // Windows環境でのパフォーマンス情報（リサイズ中の更新ごと）
        if (isWindows.current && dragMode === 'free') {
          // フリーモード専用の軽量ログ（更新頻度を制限）
          if (Math.random() < 0.1) { // 10%の確率でログ出力（パフォーマンス重視）
            console.log('[Windows-Free] リサイズ中:', {
              handle: resizeStart.handle,
              size: { width: newWidth, height: newHeight },
              position: { x: newX, y: newY }
            });
          }
        }
        return;
      }

      // Windows向け簡素化された計算
      if (windowsOptimization.current.useSimplifiedResize) {
        // 基本的なリサイズ計算のみ実行
        switch (resizeStart.handle) {
          case 'se': // 右下角 - 位置変更なし
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            break;
            
          case 'sw': // 左下角 - X座標が変更される
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            newX = resizeStart.imgX + (resizeStart.width - newWidth);
            break;
            
          case 'ne': // 右上角 - Y座標が変更される
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newY = resizeStart.imgY + (resizeStart.height - newHeight);
            break;
            
          case 'nw': // 左上角 - X, Y座標両方が変更される
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newX = resizeStart.imgX + (resizeStart.width - newWidth);
            newY = resizeStart.imgY + (resizeStart.height - newHeight);
            break;
        }

        // 簡素化されたアスペクト比維持（Windowsのみ、複雑な座標調整を省略）
        if (image.aspectRatioLocked && !e.shiftKey) {
          const aspectRatio = image.originalWidth / image.originalHeight;
          const currentRatio = newWidth / newHeight;
          
          if (currentRatio > aspectRatio) {
            newWidth = newHeight * aspectRatio;
          } else {
            newHeight = newWidth / aspectRatio;
          }
        }

        // 簡素化された境界制限
        const bounds = getCanvasBounds();
        newX = Math.max(0, Math.min(bounds.width - newWidth, newX));
        newY = Math.max(0, Math.min(bounds.height - newHeight, newY));
        newWidth = Math.max(50, Math.min(bounds.width - newX, newWidth));
        newHeight = Math.max(50, Math.min(bounds.height - newY, newHeight));

      } else {
        // 従来の完全な計算（macOS等）
        const aspectRatio = image.originalWidth / image.originalHeight;
        const isAspectLocked = image.aspectRatioLocked && !e.shiftKey;
        const bounds = getCanvasBounds();

        // 各ハンドルの処理（開始時の座標を基準に計算）
        switch (resizeStart.handle) {
          case 'se': // 右下角 - 位置変更なし
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            // newX, newYは変更なし
            break;
            
          case 'sw': // 左下角 - X座標が変更される
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            newX = resizeStart.imgX + (resizeStart.width - newWidth);
            // newYは変更なし
            break;
            
          case 'ne': // 右上角 - Y座標が変更される
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            // newXは変更なし
            newY = resizeStart.imgY + (resizeStart.height - newHeight);
            break;
            
          case 'nw': // 左上角 - X, Y座標両方が変更される
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newX = resizeStart.imgX + (resizeStart.width - newWidth);
            newY = resizeStart.imgY + (resizeStart.height - newHeight);
            break;
        }

        // アスペクト比維持の処理（座標補正を含む）
        if (isAspectLocked) {
          const currentRatio = newWidth / newHeight;
          
          if (currentRatio > aspectRatio) {
            // 幅が大きすぎる場合、幅を縮小
            const adjustedWidth = newHeight * aspectRatio;
            const widthDiff = newWidth - adjustedWidth;
            newWidth = adjustedWidth;
            
            // 左側のハンドルの場合、X座標を調整
            if (resizeStart.handle === 'sw' || resizeStart.handle === 'nw') {
              newX += widthDiff;
            }
          } else if (currentRatio < aspectRatio) {
            // 高さが大きすぎる場合、高さを縮小
            const adjustedHeight = newWidth / aspectRatio;
            const heightDiff = newHeight - adjustedHeight;
            newHeight = adjustedHeight;
            
            // 上側のハンドルの場合、Y座標を調整
            if (resizeStart.handle === 'ne' || resizeStart.handle === 'nw') {
              newY += heightDiff;
            }
          }
        }

        // 境界制限の適用（座標とサイズを同時に調整）
        // 最小位置制限
        if (newX < 0) {
          newWidth = newWidth + newX; // 左にはみ出た分、幅を縮小
          newX = 0;
        }
        if (newY < 0) {
          newHeight = newHeight + newY; // 上にはみ出た分、高さを縮小
          newY = 0;
        }
        
        // 最大位置制限
        if (newX + newWidth > bounds.width) {
          newWidth = bounds.width - newX;
        }
        if (newY + newHeight > bounds.height) {
          newHeight = bounds.height - newY;
        }

        // 最小サイズを再度確保（境界制限で小さくなりすぎた場合）
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(50, newHeight);
      }

      // グリッドスナップモードの場合はスナップを適用（Windows向け簡素化）
      if (dragMode === 'grid-snap') {
        const gridSize = windowsOptimization.current.useSimplifiedResize ? 44 : 22; // Windowsでは大きめのグリッド
        newX = snapToGrid(newX, gridSize);
        newY = snapToGrid(newY, gridSize);
        newWidth = snapToGrid(newWidth, gridSize);
        newHeight = snapToGrid(newHeight, gridSize);
      }

      // 最適化されたupdate関数を使用
      optimizedUpdateImage({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    },
    [resizeStart, image.originalWidth, image.originalHeight, image.aspectRatioLocked, optimizedUpdateImage, getCanvasBounds, dragMode, snapToGrid, isWindows]
  );

  // ドラッグ終了
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart) {
      // グリッドスナップモードの場合は最終位置でスナップを適用
      if (dragMode === 'grid-snap') {
        const snappedX = snapToGrid(image.x);
        const snappedY = snapToGrid(image.y);
        
        // スナップした位置に更新
        updateImage(image.id, {
          x: snappedX,
          y: snappedY,
        });
      }
      
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
        
        // Windows環境でのパフォーマンス情報
        if (isWindows.current) {
          console.log('[Windows最適化] リサイズ完了:', {
            handle: resizeStart.handle,
            originalSize: { width: resizeStart.width, height: resizeStart.height },
            newSize: { width: image.width, height: image.height },
            deltaSize: { width: deltaWidth, height: deltaHeight },
            dragMode,
            isFreeModeOptimized: dragMode === 'free',
            optimization: windowsOptimization.current
          });
          
          // フリーモード専用のパフォーマンス測定終了
          if (dragMode === 'free') {
            console.timeEnd('[Windows-Free] リサイズパフォーマンス');
            console.log('[Windows-Free] 超軽量最適化が適用されました');
          }
        }
      }
    }

    // requestAnimationFrameのクリーンアップ
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    // 最後の更新を強制実行
    if (pendingUpdateRef.current) {
      updateImage(image.id, pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }

    // フリーモードでドラッグしていた場合はスムーズな遷移を開始
    if (isDragging && dragMode === 'free') {
      setIsTransitioning(true);
      // 遷移完了後にtransitioningを解除（transitionEndイベントまたはタイムアウト）
      const timeoutId = setTimeout(() => {
        setIsTransitioning(false);
      }, 150); // 0.1秒のtransition + 50msの安全マージン
      
      // cleanup用にtimeoutIdを保存
      const cleanup = () => {
        clearTimeout(timeoutId);
        setIsTransitioning(false);
      };
      
      // 短時間でcleanupを実行
      setTimeout(cleanup, 150);
    }

    setIsDragging(false);
    setIsResizing(false);
    setDragStart(null);
    setResizeStart(null);
  }, [isDragging, isResizing, dragStart, resizeStart, image.x, image.y, image.width, image.height, dispatch, updateImage, image.id, dragMode, snapToGrid]);

  // リサイズハンドルの開始
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();

      selectImage(image.id);
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        imgX: image.x,
        imgY: image.y,
        width: image.width,
        height: image.height,
        handle,
      });

      // Windows環境でのデバッグ情報
      if (isWindows.current) {
        console.log('[Windows最適化] リサイズ開始:', {
          handle,
          dragMode,
          isFreeModeOptimized: dragMode === 'free',
          optimization: windowsOptimization.current,
          imageSize: { width: image.width, height: image.height },
          position: { x: image.x, y: image.y },
          renderingMode: dragMode === 'free' ? 'ultra-lightweight' : 'simplified'
        });
        
        // フリーモード専用のパフォーマンス測定開始
        if (dragMode === 'free') {
          console.time('[Windows-Free] リサイズパフォーマンス');
        }
      }
    },
    [selectImage, image.id, image.x, image.y, image.width, image.height, dragMode]
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
  const contextMenuActions: Array<{
    label?: string;
    icon?: React.ComponentType<{ className?: string }>;
    action?: () => void;
    danger?: boolean;
    separator?: boolean;
  }> = [
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
        className={`absolute select-none ${
          // Windows環境のフリーモードリサイズ中はtransitionを完全に無効化
          (isDragging && dragMode === 'free') || isTransitioning || (isWindows.current && isResizing && dragMode === 'free') ? '' : 'transition-all duration-75'
        } ${
          // Windows環境のフリーモードリサイズ中は超軽量CSSクラスを適用
          isWindows.current && isResizing && dragMode === 'free' ? 'windows-free-resize' : ''
        } ${
          isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
        } ${isDragging ? 'z-50' : ''}`}
        style={{
          // Windows環境のフリーモードリサイズ中は完全に直接制御
          ...(isWindows.current && isResizing && dragMode === 'free' ? {
            // Windows + フリーモード + リサイズ中: 最軽量設定
            left: image.x,
            top: image.y,
            transform: 'none',
            willChange: 'auto',
            transition: 'none',
            isolation: 'auto',
            containIntrinsicSize: 'none',
          } : dragMode === 'free' && (isDragging || isTransitioning) && !(isWindows.current && isResizing) ? {
            // フリーモード時でWindows環境でリサイズ中でない場合のみGPU加速のためtransformを使用
            // left/topを0に固定してtransformのみで位置制御
            left: 0,
            top: 0,
            transform: `translate3d(${image.x}px, ${image.y}px, 0)`,
            willChange: isDragging ? 'transform' : 'auto',
            // 合成レイヤーのヒント
            backfaceVisibility: 'hidden',
            perspective: 1000,
            ...(isTransitioning ? {
              transition: 'transform 0.1s ease-out',
            } : {}),
          } : {
            // 通常時またはWindows環境でのリサイズ中はleft/topを使用（transformは無効化）
            left: image.x,
            top: image.y,
            transform: 'none',
            // Windows環境でのリサイズ中はwillChangeを無効化してレンダリング負荷を軽減
            ...(isWindows.current && isResizing ? {
              willChange: 'auto',
              // Windows環境向けの追加最適化
              isolation: 'auto',
              containIntrinsicSize: 'none',
            } : {}),
          }),
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
          className={`w-full h-full object-cover rounded shadow-lg ${
            isWindows.current && isResizing ? 'image-rendering-speed' : ''
          }`}
          draggable={false}
          style={{
            opacity: image.opacity ?? 1,
            // Windows環境のフリーモードリサイズ中は画像レンダリングも最適化
            ...(isWindows.current && isResizing && dragMode === 'free' ? {
              transformOrigin: 'top left',
              willChange: 'auto',
              // スムーズなリサイズのためのヒント
              imageRendering: 'auto', // 速度重視から品質重視に変更
            } : isWindows.current && isResizing ? {
              transformOrigin: 'top left',
            } : {}),
          }}
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
              />
            ))}
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