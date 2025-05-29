import React, { useState, useEffect } from 'react';
import { usePasteHandler } from './hooks/usePasteHandler';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Header from './components/Header';
import ImageCanvas from './components/ImageCanvas';
import LayerSidebar from './components/LayerSidebar';
import CropOverlay from './components/CropOverlay';
import DownloadDialog from './components/DownloadDialog';
import { useImageContext } from './context/ImageContext';
import { ImageItem, DownloadFormat } from './types';

const App: React.FC = () => {
  const { state, dispatch } = useImageContext();
  const [cropImage, setCropImage] = useState<ImageItem | null>(null);
  const [downloadImage, setDownloadImage] = useState<ImageItem | null>(null);
  const [clipboardSupport, setClipboardSupport] = useState<{
    modern: boolean;
    legacy: boolean;
  }>({ modern: false, legacy: true });

  // グローバルフックの初期化
  usePasteHandler();
  useKeyboardShortcuts();

  // クリップボードサポートのチェック
  useEffect(() => {
    const checkClipboardSupport = () => {
      const modernSupport = !!(navigator.clipboard && navigator.clipboard.read);
      const legacySupport = !!(navigator.clipboard && 'ClipboardEvent' in window);
      
      setClipboardSupport({
        modern: modernSupport,
        legacy: legacySupport,
      });

      if (!modernSupport) {
        console.info('Modern Clipboard API not supported. Using legacy paste events for compatibility.');
      }
    };

    checkClipboardSupport();
  }, []);

  // トリミング関連
  const handleStartCrop = (image: ImageItem) => {
    setCropImage(image);
  };

  const handleCloseCrop = () => {
    setCropImage(null);
  };

  // ダウンロード関連
  const handleStartDownload = (image: ImageItem) => {
    setDownloadImage(image);
  };

  const handleCloseDownload = () => {
    setDownloadImage(null);
  };

  const handleDownload = async (format: DownloadFormat, quality: number) => {
    if (!downloadImage) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = downloadImage.width;
      canvas.height = downloadImage.height;

      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, downloadImage.width, downloadImage.height);
          resolve();
        };
        img.onerror = reject;
        img.src = downloadImage.src;
      });

      let mimeType = 'image/png';
      let qualityValue = undefined;
      let extension = 'png';

      if (format === 'jpeg') {
        mimeType = 'image/jpeg';
        qualityValue = quality / 100;
        extension = 'jpg';
      } else if (format === 'webp') {
        mimeType = 'image/webp';
        qualityValue = quality / 100;
        extension = 'webp';
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) return;

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `image_${Date.now()}.${extension}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        mimeType,
        qualityValue
      );
    } catch (error) {
      console.error('Download failed:', error);
      alert('ダウンロードに失敗しました。');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900 overflow-hidden">
      {/* ヘッダー */}
      <Header />

      {/* ボード領域（ヘッダー直下から最大高さ） */}
      <div className="flex flex-1 overflow-hidden relative bg-slate-100 dark:bg-slate-800">
        {/* 画像キャンバス - 境界制限付き */}
        <div className="flex-1 relative overflow-hidden">
          <ImageCanvas
            onStartCrop={handleStartCrop}
            onStartDownload={handleStartDownload}
          />
        </div>

        {/* レイヤーサイドバー */}
        <LayerSidebar
          isOpen={state.layerSidebarVisible}
          onClose={() => dispatch({ type: 'TOGGLE_LAYER_SIDEBAR' })}
        />
      </div>

      {/* ローディングオーバーレイ */}
      {state.isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <span className="text-slate-700 dark:text-slate-300">
                画像を処理中...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 初期説明（画像がない場合） */}
      {state.images.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center p-8 max-w-md bg-white dark:bg-slate-700 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">
              Image Canvas へようこそ
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              クリップボードから画像を貼り付けて編集を始めましょう
            </p>
            <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
              <p>
                <strong>Ctrl+V</strong> (Mac: ⌘V) - 画像を貼り付け
                {!clipboardSupport.modern && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                    (レガシーモード)
                  </span>
                )}
              </p>
              <p>
                <strong>L</strong> - レイヤーサイドバー表示
              </p>
              <p>
                <strong>Ctrl+Z</strong> (Mac: ⌘Z) - 元に戻す
              </p>
              {!clipboardSupport.modern && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 italic">
                  このブラウザではレガシークリップボード機能を使用します
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* トリミングオーバーレイ */}
      {cropImage && <CropOverlay image={cropImage} onClose={handleCloseCrop} />}

      {/* ダウンロードダイアログ */}
      {downloadImage && (
        <DownloadDialog
          image={downloadImage}
          onClose={handleCloseDownload}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

export default App;
 