import { useCallback, useState } from 'react';
import { saveAs } from 'file-saver';
import { useImageContext } from '../context/ImageContext';
import type {
  DownloadFormat,
  DownloadOptions,
  ExportSettings,
  FileSizeInfo,
} from '../types';

export const useExport = () => {
  const { state } = useImageContext();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // ファイルサイズの予測
  const estimateFileSize = useCallback(
    (
      width: number,
      height: number,
      format: DownloadFormat,
      quality: number
    ): FileSizeInfo => {
      const pixels = width * height;
      let estimatedBytes = 0;

      switch (format) {
        case 'png':
          // PNGは圧縮効率が低いが可逆
          estimatedBytes = pixels * 3; // RGB
          break;
        case 'jpeg':
          // JPEGは非可逆圧縮
          estimatedBytes = (pixels * 3 * quality) / 3;
          break;
        case 'webp':
          // WebPは効率的な圧縮
          estimatedBytes = (pixels * 3 * quality) / 4;
          break;
      }

      if (estimatedBytes < 1024) {
        return {
          size: estimatedBytes,
          unit: 'B',
          formatted: `${Math.round(estimatedBytes)}B`,
        };
      } else if (estimatedBytes < 1024 * 1024) {
        const kb = estimatedBytes / 1024;
        return { size: kb, unit: 'KB', formatted: `${Math.round(kb)}KB` };
      } else {
        const mb = estimatedBytes / (1024 * 1024);
        return { size: mb, unit: 'MB', formatted: `${mb.toFixed(1)}MB` };
      }
    },
    []
  );

  // 単一画像のダウンロード
  const downloadSingleImage = useCallback(
    async (imageId: string, options: DownloadOptions): Promise<void> => {
      const image = state.images.find((img) => img.id === imageId);
      if (!image) {
        throw new Error('Image not found');
      }

      setIsExporting(true);
      setExportProgress(0);

      try {
        // Canvasを作成
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context not available');
        }

        // Canvasサイズを設定
        canvas.width = image.width;
        canvas.height = image.height;

        setExportProgress(25);

        // 画像を読み込み
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = image.src;
        });

        setExportProgress(50);

        // 画像を描画
        ctx.drawImage(img, 0, 0, image.width, image.height);

        setExportProgress(75);

        // 指定された形式でエクスポート
        const mimeType = `image/${options.format}`;
        const dataUrl = canvas.toDataURL(mimeType, options.quality);

        // Blobに変換
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        setExportProgress(100);

        // ファイル名を生成
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `image-canvas-${timestamp}.${options.format}`;

        // ダウンロード
        saveAs(blob, filename);
      } catch (error) {
        console.error('Failed to download image:', error);
        throw error;
      } finally {
        setIsExporting(false);
        setExportProgress(0);
      }
    },
    [state.images]
  );

  // 全画像の統合書き出し
  const exportAllImages = useCallback(
    async (settings: ExportSettings): Promise<void> => {
      if (state.images.length === 0) {
        throw new Error('No images to export');
      }

      setIsExporting(true);
      setExportProgress(0);

      try {
        // 可視画像のみをフィルタ
        const visibleImages = state.images.filter((img) => img.visible);
        if (visibleImages.length === 0) {
          throw new Error('No visible images to export');
        }

        // 境界を計算
        const bounds = visibleImages.reduce(
          (acc, img) => ({
            minX: Math.min(acc.minX, img.x),
            minY: Math.min(acc.minY, img.y),
            maxX: Math.max(acc.maxX, img.x + img.width),
            maxY: Math.max(acc.maxY, img.y + img.height),
          }),
          {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
          }
        );

        const padding = 20;
        const canvasWidth =
          (bounds.maxX - bounds.minX + padding * 2) * settings.scale;
        const canvasHeight =
          (bounds.maxY - bounds.minY + padding * 2) * settings.scale;

        setExportProgress(10);

        // Canvasを作成
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context not available');
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 背景色を設定
        if (settings.includeBackground) {
          ctx.fillStyle = settings.backgroundColor;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        setExportProgress(20);

        // z-index順にソート
        const sortedImages = [...visibleImages].sort(
          (a, b) => a.zIndex - b.zIndex
        );

        // 各画像を描画
        for (let i = 0; i < sortedImages.length; i++) {
          const image = sortedImages[i];

          try {
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = image.src;
            });

            // 相対位置を計算
            const x = (image.x - bounds.minX + padding) * settings.scale;
            const y = (image.y - bounds.minY + padding) * settings.scale;
            const width = image.width * settings.scale;
            const height = image.height * settings.scale;

            // 不透明度を適用
            if (image.opacity !== undefined) {
              ctx.globalAlpha = image.opacity;
            }

            // 回転を適用
            if (image.rotation) {
              ctx.save();
              ctx.translate(x + width / 2, y + height / 2);
              ctx.rotate((image.rotation * Math.PI) / 180);
              ctx.drawImage(img, -width / 2, -height / 2, width, height);
              ctx.restore();
            } else {
              ctx.drawImage(img, x, y, width, height);
            }

            // アルファ値をリセット
            ctx.globalAlpha = 1;

            // 進捗更新
            setExportProgress(20 + ((i + 1) / sortedImages.length) * 60);
          } catch (error) {
            console.warn(`Failed to draw image ${image.id}:`, error);
          }
        }

        setExportProgress(90);

        // 指定された形式でエクスポート
        const mimeType = `image/${settings.format}`;
        const dataUrl = canvas.toDataURL(mimeType, settings.quality);

        // Blobに変換
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        setExportProgress(100);

        // ファイル名を生成
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `image-canvas-export-${timestamp}.${settings.format}`;

        // ダウンロード
        saveAs(blob, filename);
      } catch (error) {
        console.error('Failed to export images:', error);
        throw error;
      } finally {
        setIsExporting(false);
        setExportProgress(0);
      }
    },
    [state.images]
  );

  // 画像をクリップボードにコピー
  const copyImageToClipboard = useCallback(
    async (imageId: string): Promise<void> => {
      const image = state.images.find((img) => img.id === imageId);
      if (!image) {
        throw new Error('Image not found');
      }

      try {
        // Data URLからBlobに変換
        const response = await fetch(image.src);
        const blob = await response.blob();

        // クリップボードに書き込み
        if (navigator.clipboard && navigator.clipboard.write) {
          const clipboardItem = new ClipboardItem({
            [blob.type]: blob,
          });
          await navigator.clipboard.write([clipboardItem]);
        } else {
          throw new Error('Clipboard API not supported');
        }
      } catch (error) {
        console.error('Failed to copy image to clipboard:', error);
        throw error;
      }
    },
    [state.images]
  );

  // Canvas要素をPNG形式で取得
  const getCanvasAsDataURL = useCallback(
    (format: DownloadFormat = 'png', quality: number = 1.0): string => {
      const canvas = document.getElementById(
        'image-canvas'
      ) as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas not found');
      }

      const mimeType = `image/${format}`;
      return canvas.toDataURL(mimeType, quality);
    },
    []
  );

  // プレビュー画像の生成
  const generatePreview = useCallback(
    async (imageId: string, options: DownloadOptions): Promise<string> => {
      const image = state.images.find((img) => img.id === imageId);
      if (!image) {
        throw new Error('Image not found');
      }

      // 小さなプレビュー用Canvasを作成
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      // プレビューサイズ（最大200px）
      const maxSize = 200;
      const ratio = Math.min(maxSize / image.width, maxSize / image.height);
      canvas.width = image.width * ratio;
      canvas.height = image.height * ratio;

      // 画像を読み込んで描画
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = image.src;
      });

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 指定された形式で返す
      const mimeType = `image/${options.format}`;
      return canvas.toDataURL(mimeType, options.quality);
    },
    [state.images]
  );

  return {
    downloadSingleImage,
    exportAllImages,
    copyImageToClipboard,
    getCanvasAsDataURL,
    generatePreview,
    estimateFileSize,
    isExporting,
    exportProgress,
  };
};
