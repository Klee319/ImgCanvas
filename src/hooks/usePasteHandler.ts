import { useEffect, useCallback, useState } from 'react';
import { useClipboard } from './useClipboard';
import { useImageContext } from '../context/ImageContext';

// グローバルなアラート制御（モジュールレベル）
let isResizeAlertShowing = false;
let lastResizeAlertTime = 0;
const RESIZE_ALERT_COOLDOWN = 3000; // 3秒のクールダウン

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

  // 画像サイズの自動調整（安定化キャンバスサイズ対応）
  const adjustImageSize = useCallback(
    (originalWidth: number, originalHeight: number) => {
      try {
        // 安定したキャンバスサイズを取得（デフォルト値で安定性確保）
        const canvas = document.getElementById('image-canvas');
        const canvasRect = canvas?.getBoundingClientRect();
        
        // より保守的なサイズ制限（デフォルト値を大きめに設定）
        const defaultMaxWidth = 1200; // デフォルト最大幅
        const defaultMaxHeight = 900; // デフォルト最大高さ
        
        const maxWidth = canvasRect ? Math.max(canvasRect.width * 0.85, 800) : defaultMaxWidth;
        const maxHeight = canvasRect ? Math.max(canvasRect.height * 0.85, 600) : defaultMaxHeight;

        let width = originalWidth;
        let height = originalHeight;
        let wasResized = false;

        // 明らかに大きすぎる場合のみ縮小（閾値を上げる）
        const isTooWide = width > maxWidth;
        const isTooTall = height > maxHeight;
        
        if (isTooWide || isTooTall) {
          const widthRatio = maxWidth / width;
          const heightRatio = maxHeight / height;
          const ratio = Math.min(widthRatio, heightRatio);

          // 縮小比率が極端でない場合のみ縮小
          if (ratio < 0.9) {
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
            wasResized = true;
            
            console.info('Image resized for canvas fit:', {
              original: `${originalWidth}×${originalHeight}`,
              adjusted: `${width}×${height}`,
              ratio: `${Math.round((1-ratio) * 100)}% reduction`,
              canvasSize: `${maxWidth}×${maxHeight}`
            });
            
            // 非同期でユーザー通知（UXを阻害しない）
            setTimeout(() => {
              const reduction = Math.round((1 - ratio) * 100);
              const now = Date.now();
              
              if (!isResizeAlertShowing && (now - lastResizeAlertTime > RESIZE_ALERT_COOLDOWN)) {
                isResizeAlertShowing = true;
                console.info('Showing resize alert');
                
                alert(
                  `画像がキャンバスより大きいため、自動で${reduction}%縮小しました。\n` +
                  `元のサイズ: ${originalWidth}×${originalHeight}px\n` +
                  `調整後: ${width}×${height}px`
                );
                
                lastResizeAlertTime = now;
                
                // アラート表示完了後にフラグをリセット
                setTimeout(() => {
                  isResizeAlertShowing = false;
                  console.info('Reset resize alert flag');
                }, 500); // アラートが閉じられるまでの時間を考慮
              } else {
                console.info('Skipping duplicate resize alert', {
                  isShowing: isResizeAlertShowing,
                  timeSinceLastAlert: now - lastResizeAlertTime,
                  cooldown: RESIZE_ALERT_COOLDOWN
                });
              }
            }, 100);
          }
        }

        return { width, height, wasResized };
      } catch (error) {
        console.error('Error in adjustImageSize:', error);
        // エラー時は元のサイズをそのまま返す（安全な動作）
        return { 
          width: originalWidth, 
          height: originalHeight, 
          wasResized: false 
        };
      }
    },
    []
  );

  // クリップボードから画像を処理（エラーハンドリング強化）
  const handlePasteFromClipboard = useCallback(async () => {
    if (isProcessingPaste) {
      console.info('Paste already in progress, skipping...');
      return false;
    }

    setIsProcessingPaste(true);

    try {
      console.info('Starting Modern Clipboard API paste...');
      
      // まずModern Clipboard APIを試行
      const imageDataUrl = await readImageFromClipboard();
      
      // 画像サイズチェック（メモリ不足防止）
      const imageSizeInMB = (imageDataUrl.length * 0.75) / (1024 * 1024); // Base64のサイズ概算
      if (imageSizeInMB > 50) { // 50MB制限
        throw new Error(`画像サイズが大きすぎます (${imageSizeInMB.toFixed(1)}MB)。50MB以下の画像を使用してください。`);
      }
      
      const { width: originalWidth, height: originalHeight } =
        await getImageDimensions(imageDataUrl);
      
      // 異常に大きな画像の拒否
      if (originalWidth > 8000 || originalHeight > 8000) {
        throw new Error(`画像の解像度が大きすぎます (${originalWidth}×${originalHeight})。8000×8000px以下の画像を使用してください。`);
      }
      
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

      console.info('✅ Successfully pasted image using Modern Clipboard API', {
        size: `${originalWidth}×${originalHeight}`,
        adjusted: `${width}×${height}`,
        position: `(${x}, ${y})`
      });
      return true;
    } catch (err) {
      console.warn('Modern Clipboard API failed:', err);
      
      // ユーザーに分かりやすいエラーメッセージを表示
      if (err instanceof Error) {
        if (err.message.includes('大きすぎます') || err.message.includes('解像度')) {
          // サイズエラーは即座に表示
          alert(err.message);
        } else if (err.message.includes('No image found')) {
          console.info('No image in clipboard, user should copy an image first');
        }
      }
      
      // Modern Clipboard APIが失敗した場合は、ペーストイベントを待つ
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

  // レガシー貼り付けイベントの処理（エラーハンドリング強化）
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
        setIsProcessingPaste(false);
        return false;
      }

      // デバッグ用：クリップボードの内容を表示
      const items = event.clipboardData.items;
      console.info('Clipboard contains:', Array.from(items).map(item => ({ type: item.type, kind: item.kind })));
      
      try {
        const imageDataUrl = await readImageFromClipboardLegacy(event);
        
        // 画像サイズチェック（メモリ不足防止）
        const imageSizeInMB = (imageDataUrl.length * 0.75) / (1024 * 1024);
        if (imageSizeInMB > 50) {
          throw new Error(`画像サイズが大きすぎます (${imageSizeInMB.toFixed(1)}MB)。50MB以下の画像を使用してください。`);
        }
        
        const { width: originalWidth, height: originalHeight } =
          await getImageDimensions(imageDataUrl);
          
        // 異常に大きな画像の拒否
        if (originalWidth > 8000 || originalHeight > 8000) {
          throw new Error(`画像の解像度が大きすぎます (${originalWidth}×${originalHeight})。8000×8000px以下の画像を使用してください。`);
        }
        
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

        console.info('✅ Successfully pasted image using legacy handler', {
          size: `${originalWidth}×${originalHeight}`,
          adjusted: `${width}×${height}`,
          position: `(${x}, ${y})`
        });
        return true;
      } catch (err) {
        console.error('Failed to paste image using legacy handler:', err);
        
        // ユーザーに分かりやすいエラーメッセージを表示
        if (err instanceof Error) {
          if (err.message.includes('大きすぎます') || err.message.includes('解像度')) {
            // サイズエラーは即座に表示
            alert(err.message);
          } else if (err.message.includes('No image found')) {
            console.info('No image data found in clipboard. Please copy an image first.');
          } else {
            // その他のエラーも表示
            alert(`画像の貼り付けに失敗しました: ${err.message}`);
          }
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

  // ドラッグ&ドロップによるファイル貼り付け（エラーハンドリング強化）
  const handleFileDrop = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const imageFiles = fileArray.filter((file) =>
        file.type.startsWith('image/')
      );

      if (imageFiles.length === 0) {
        alert('画像ファイルが見つかりません。画像ファイルをドロップしてください。');
        return;
      }

      for (const file of imageFiles) {
        try {
          // ファイルサイズチェック
          const fileSizeInMB = file.size / (1024 * 1024);
          if (fileSizeInMB > 50) {
            alert(`ファイル "${file.name}" が大きすぎます (${fileSizeInMB.toFixed(1)}MB)。50MB以下のファイルを使用してください。`);
            continue;
          }

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
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
          });

          const { width: originalWidth, height: originalHeight } =
            await getImageDimensions(imageDataUrl);
            
          // 異常に大きな画像の拒否
          if (originalWidth > 8000 || originalHeight > 8000) {
            alert(`ファイル "${file.name}" の解像度が大きすぎます (${originalWidth}×${originalHeight})。8000×8000px以下の画像を使用してください。`);
            continue;
          }
          
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
          
          console.info(`✅ Successfully dropped file: ${file.name}`, {
            size: `${originalWidth}×${originalHeight}`,
            adjusted: `${width}×${height}`,
            position: `(${x}, ${y})`
          });
        } catch (err) {
          console.error(`Failed to process dropped file: ${file.name}`, err);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          alert(`ファイル "${file.name}" の処理に失敗しました: ${errorMessage}`);
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
