import { useState, useCallback } from 'react';

export interface ClipboardOptions {
  onSuccess?: (imageDataUrl: string) => void;
  onError?: (error: Error) => void;
}

export const useClipboard = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // クリップボードから画像を読み取る
  const readImageFromClipboard = useCallback(
    async (options?: ClipboardOptions) => {
      setIsLoading(true);
      setError(null);

      try {
        // Clipboard API が利用可能かチェック
        if (!navigator.clipboard || !navigator.clipboard.read) {
          throw new Error('Modern Clipboard API is not supported in this browser. Please use Ctrl+V paste event instead.');
        }

        // クリップボードのデータを読み取り
        const clipboardItems = await navigator.clipboard.read();

        for (const clipboardItem of clipboardItems) {
          // 画像タイプをチェック
          const imageTypes = clipboardItem.types.filter((type) =>
            type.startsWith('image/')
          );

          if (imageTypes.length === 0) {
            throw new Error('No image found in clipboard');
          }

          // 最初の画像タイプを使用
          const imageType = imageTypes[0];
          const blob = await clipboardItem.getType(imageType);

          // BlobをDataURLに変換
          const reader = new FileReader();

          return new Promise<string>((resolve, reject) => {
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                options?.onSuccess?.(dataUrl);
                resolve(dataUrl);
              } else {
                const error = new Error('Failed to convert image to data URL');
                options?.onError?.(error);
                reject(error);
              }
            };

            reader.onerror = () => {
              const error = new Error('Failed to read image data');
              options?.onError?.(error);
              reject(error);
            };

            reader.readAsDataURL(blob);
          });
        }

        throw new Error('No valid image data found');
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Unknown clipboard error');
        setError(error.message);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 画像をクリップボードに書き込む
  const writeImageToClipboard = useCallback(async (imageDataUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Clipboard API が利用可能かチェック
      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error('Clipboard write API is not supported in this browser');
      }

      // Data URLからBlobに変換
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();

      // ClipboardItemを作成
      const clipboardItem = new ClipboardItem({
        [blob.type]: blob,
      });

      // クリップボードに書き込み
      await navigator.clipboard.write([clipboardItem]);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Unknown clipboard error');
      setError(error.message);

      // フォールバック: テキストとしてコピー（開発用）
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(imageDataUrl);
          console.warn('Fallback: Copied image as data URL text');
        } catch (fallbackError) {
          console.warn('Fallback clipboard write also failed:', fallbackError);
        }
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // レガシーブラウザのフォールバック処理
  const readImageFromClipboardLegacy = useCallback(
    async (pasteEvent?: ClipboardEvent) => {
      setIsLoading(true);
      setError(null);

      try {
        if (!pasteEvent?.clipboardData) {
          throw new Error('No clipboard data available');
        }

        const items = pasteEvent.clipboardData.items;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) {
              continue;
            }

            const reader = new FileReader();

            return new Promise<string>((resolve, reject) => {
              reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) {
                  resolve(dataUrl);
                } else {
                  reject(new Error('Failed to convert image to data URL'));
                }
              };

              reader.onerror = () => {
                reject(new Error('Failed to read image data'));
              };

              reader.readAsDataURL(file);
            });
          }
        }

        throw new Error('No image found in clipboard data');
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Unknown clipboard error');
        setError(error.message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ブラウザサポートチェック
  const isClipboardSupported = useCallback(() => {
    return !!(navigator.clipboard && navigator.clipboard.read);
  }, []);

  const isClipboardWriteSupported = useCallback(() => {
    return !!(navigator.clipboard && navigator.clipboard.write);
  }, []);

  // クリップボード権限のリクエスト
  const requestClipboardPermission = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({
        name: 'clipboard-read' as PermissionName,
      });
      return permission.state === 'granted';
    } catch {
      // 権限APIがサポートされていない場合は true を返す
      return true;
    }
  }, []);

  return {
    readImageFromClipboard,
    writeImageToClipboard,
    readImageFromClipboardLegacy,
    isClipboardSupported,
    isClipboardWriteSupported,
    requestClipboardPermission,
    isLoading,
    error,
    clearError: () => setError(null),
  };
};
