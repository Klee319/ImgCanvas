import { useEffect, useCallback, useState } from 'react';
import { useClipboard } from './useClipboard';
import { useImageContext } from '../context/ImageContext';

export const usePasteHandler = () => {
  const {
    readImageFromClipboard,
    readImageFromClipboardLegacy,
    isClipboardSupported,
    isLoading,
    error,
  } = useClipboard();
  const { addImage, state } = useImageContext();
  
  // ペースト処理中フラグで重複実行を防ぐ
  const [isProcessingPaste, setIsProcessingPaste] = useState(false);

  // 画像の寸法を取得する関数
  const getImageDimensions = useCallback(
    (src: string): Promise<{ width: number; height: number }> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        img.src = src;
      });
    },
    []
  );

  // 新しい画像の配置位置を計算
  const calculateImagePosition = useCallback(
    (imageWidth: number, imageHeight: number) => {
      const canvas = document.getElementById('image-canvas');
      const canvasRect = canvas?.getBoundingClientRect();

      // デフォルトのキャンバスサイズ（選択フレーム考慮）
      const safetyMargin = 8; // ring-offset-2 (4px) + 余裕 (4px)
      const canvasWidth = canvasRect ? canvasRect.width - safetyMargin : 792;
      const canvasHeight = canvasRect ? canvasRect.height - safetyMargin : 592;

      // キャンバスの中央を基準点とする
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // 最後に追加された画像の位置を取得（連続ペースト時のスマートな配置）
      const lastImage = state.images.length > 0 ? state.images[state.images.length - 1] : null;
      
      let x, y;
      
      if (lastImage) {
        // 最後の画像から少しオフセットした位置に配置
        const offsetX = 25; // X方向のオフセット
        const offsetY = 25; // Y方向のオフセット
        
        x = lastImage.x + offsetX;
        y = lastImage.y + offsetY;
        
        // キャンバス境界を超える場合は、新しい行に配置
        if (x + imageWidth > canvasWidth) {
          x = 50; // 左端から少し内側
          y = lastImage.y + lastImage.height + 30; // 下の行に
        }
        
        // 下端も超える場合は、中央から再開
        if (y + imageHeight > canvasHeight) {
          x = centerX - imageWidth / 2;
          y = centerY - imageHeight / 2;
        }
      } else {
        // 最初の画像は中央に配置
        x = centerX - imageWidth / 2;
        y = centerY - imageHeight / 2;
      }

      // 境界制限を適用（安全のため）
      x = Math.max(10, Math.min(canvasWidth - imageWidth - 10, x));
      y = Math.max(10, Math.min(canvasHeight - imageHeight - 10, y));

      return { x, y };
    },
    [state.images]
  );

  // 画像サイズの自動調整（動的キャンバスサイズ対応）
  const adjustImageSize = useCallback(
    (originalWidth: number, originalHeight: number) => {
      // 動的にキャンバスサイズを取得
      const canvas = document.getElementById('image-canvas');
      const canvasRect = canvas?.getBoundingClientRect();
      
      const maxWidth = canvasRect ? canvasRect.width * 0.9 : 720; // キャンバスの90%
      const maxHeight = canvasRect ? canvasRect.height * 0.9 : 540; // キャンバスの90%

      let width = originalWidth;
      let height = originalHeight;
      let wasResized = false;

      // 大きすぎる場合は縮小
      if (width > maxWidth || height > maxHeight) {
        const widthRatio = maxWidth / width;
        const heightRatio = maxHeight / height;
        const ratio = Math.min(widthRatio, heightRatio);

        width = width * ratio;
        height = height * ratio;
        wasResized = true;
        
        // アラート表示（非同期で表示してUXを阻害しない）
        setTimeout(() => {
          const reduction = Math.round((1 - ratio) * 100);
          alert(
            `画像がキャンバスサイズより大きいため、自動で${reduction}%縮小しました。\n` +
            `元のサイズ: ${originalWidth}×${originalHeight}px\n` +
            `調整後: ${Math.round(width)}×${Math.round(height)}px`
          );
        }, 100);
      }

      return { width, height, wasResized };
    },
    []
  );

  // クリップボードから画像を処理
  const handlePasteFromClipboard = useCallback(async () => {
    if (isProcessingPaste) {
      console.info('Paste already in progress, skipping...');
      return false;
    }

    setIsProcessingPaste(true);

    try {
      // まずModern Clipboard APIを試行
      const imageDataUrl = await readImageFromClipboard();
      const { width: originalWidth, height: originalHeight } =
        await getImageDimensions(imageDataUrl);
      const { width, height } = adjustImageSize(originalWidth, originalHeight);
      const { x, y } = calculateImagePosition(width, height);

      addImage({
        src: imageDataUrl,
        x,
        y,
        width,
        height,
        originalWidth,
        originalHeight,
        visible: true,
        aspectRatioLocked: true,
      });

      console.info('Successfully pasted image using Modern Clipboard API');
      return true;
    } catch (err) {
      console.warn('Modern Clipboard API failed, this is expected for legacy browsers:', err);
      // Modern Clipboard APIが失敗した場合は、ペーストイベントを待つ
      // この場合は何もしない（handlePasteEventが処理する）
      return false;
    } finally {
      // フラグをリセット（短時間で次のペーストを許可）
      setTimeout(() => setIsProcessingPaste(false), 1);
    }
  }, [
    isProcessingPaste,
    readImageFromClipboard,
    getImageDimensions,
    adjustImageSize,
    calculateImagePosition,
    addImage,
  ]);

  // レガシー貼り付けイベントの処理
  const handlePasteEvent = useCallback(
    async (event: ClipboardEvent) => {
      // デフォルトの貼り付けを防止
      event.preventDefault();

      // 処理中の場合はスキップ
      if (isProcessingPaste) {
        console.info('Paste already in progress, skipping paste event...');
        return false;
      }

      // Modern Clipboard APIが利用可能な場合はスキップ（重複防止）
      if (isClipboardSupported()) {
        console.info('Skipping paste event - Modern Clipboard API is available');
        return false;
      }

      setIsProcessingPaste(true);
      console.info('Processing paste event with legacy clipboard handler');
      
      // クリップボードデータの存在確認
      if (!event.clipboardData || event.clipboardData.items.length === 0) {
        console.warn('No clipboard data available in paste event');
        return false;
      }

      // デバッグ用：クリップボードの内容を表示
      const items = event.clipboardData.items;
      console.info('Clipboard contains:', Array.from(items).map(item => ({ type: item.type, kind: item.kind })));
      
      try {
        const imageDataUrl = await readImageFromClipboardLegacy(event);
        const { width: originalWidth, height: originalHeight } =
          await getImageDimensions(imageDataUrl);
        const { width, height } = adjustImageSize(
          originalWidth,
          originalHeight
        );
        const { x, y } = calculateImagePosition(width, height);

        addImage({
          src: imageDataUrl,
          x,
          y,
          width,
          height,
          originalWidth,
          originalHeight,
          visible: true,
          aspectRatioLocked: true,
        });

        console.info('Successfully pasted image using legacy handler');
        return true;
      } catch (err) {
        console.error('Failed to paste image using legacy handler:', err);
        
        // ユーザーに分かりやすいエラーメッセージを表示
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (errorMessage.includes('No image found')) {
          console.warn('No image data found in clipboard. Please copy an image first.');
        }
        
        return false;
      } finally {
        // フラグをリセット（短時間で次のペーストを許可）
        setTimeout(() => setIsProcessingPaste(false), 1);
      }
    },
    [
      isProcessingPaste,
      readImageFromClipboardLegacy,
      getImageDimensions,
      adjustImageSize,
      calculateImagePosition,
      addImage,
      isClipboardSupported,
    ]
  );

  // キーボードショートカットのハンドラー
  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      // Ctrl+V または Cmd+V
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
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

        // 処理中の場合はスキップ
        if (isProcessingPaste) {
          console.info('Paste already in progress, skipping keyboard shortcut...');
          event.preventDefault();
          return;
        }

        // 重複処理を防ぐため、常にpreventDefaultして統一的に処理
        event.preventDefault();

        // Modern Clipboard APIがサポートされている場合のみ使用
        if (isClipboardSupported()) {
          try {
            const success = await handlePasteFromClipboard();
            if (success) {
              console.info('Successfully used Modern Clipboard API');
              return; // 成功した場合は終了
            }
          } catch (err) {
            console.warn('Modern Clipboard API failed, falling back to paste event:', err);
          }
        }

        // Modern Clipboard APIが失敗またはサポートされていない場合は
        // 手動でペーストイベントをトリガー（但し重複防止フラグを設定）
        console.info('Triggering manual paste event for legacy support');
      }
    },
    [isProcessingPaste, handlePasteFromClipboard, isClipboardSupported]
  );

  // イベントリスナーの設定
  useEffect(() => {
    // キーボードショートカットのリスナー
    document.addEventListener('keydown', handleKeyDown);

    // 貼り付けイベントのリスナー
    document.addEventListener('paste', handlePasteEvent);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePasteEvent);
    };
  }, [handleKeyDown, handlePasteEvent]);

  // ドラッグ&ドロップによるファイル貼り付け
  const handleFileDrop = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const imageFiles = fileArray.filter((file) =>
        file.type.startsWith('image/')
      );

      for (const file of imageFiles) {
        try {
          const reader = new FileReader();
          const imageDataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = (event) => {
              const result = event.target?.result as string;
              if (result) {
                resolve(result);
              } else {
                reject(new Error('Failed to read file'));
              }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });

          const { width: originalWidth, height: originalHeight } =
            await getImageDimensions(imageDataUrl);
          const { width, height } = adjustImageSize(
            originalWidth,
            originalHeight
          );
          const { x, y } = calculateImagePosition(width, height);

          addImage({
            src: imageDataUrl,
            x,
            y,
            width,
            height,
            originalWidth,
            originalHeight,
            visible: true,
            aspectRatioLocked: true,
          });
        } catch (err) {
          console.error('Failed to process dropped file:', err);
        }
      }
    },
    [getImageDimensions, adjustImageSize, calculateImagePosition, addImage]
  );

  return {
    handlePasteFromClipboard,
    handlePasteEvent,
    handleFileDrop,
    isLoading,
    error,
  };
};
