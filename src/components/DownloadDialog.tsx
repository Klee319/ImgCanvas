import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  XMarkIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { ImageItem, DownloadFormat } from '../types';

interface DownloadDialogProps {
  image: ImageItem;
  onClose: () => void;
  onDownload: (format: DownloadFormat, quality: number) => void;
}

const DownloadDialog: React.FC<DownloadDialogProps> = ({
  image,
  onClose,
  onDownload,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>('png');
  const [quality, setQuality] = useState(80);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [estimatedSize, setEstimatedSize] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatOptions: {
    value: DownloadFormat;
    label: string;
    description: string;
  }[] = [
    {
      value: 'png',
      label: 'PNG',
      description: '可逆圧縮、透明度サポート、最高品質',
    },
    {
      value: 'jpeg',
      label: 'JPEG',
      description: '非可逆圧縮、小さなファイルサイズ',
    },
    {
      value: 'webp',
      label: 'WebP',
      description: '高効率圧縮、モダンフォーマット',
    },
  ];

  const qualityOptions = [
    { value: 100, label: '100%', description: '最高品質（大きなファイル）' },
    { value: 80, label: '80%', description: '高品質（推奨）' },
    { value: 60, label: '60%', description: '標準品質（小さなファイル）' },
  ];

  // プレビューとファイルサイズ推定を生成
  useEffect(() => {
    const generatePreview = async () => {
      if (!canvasRef.current) return;

      setIsGenerating(true);

      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = image.width;
        canvas.height = image.height;

        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0, image.width, image.height);
            resolve();
          };
          img.onerror = reject;
          img.src = image.src;
        });

        // プレビュー生成
        let mimeType = 'image/png';
        let qualityValue = undefined;

        if (selectedFormat === 'jpeg') {
          mimeType = 'image/jpeg';
          qualityValue = quality / 100;
        } else if (selectedFormat === 'webp') {
          mimeType = 'image/webp';
          qualityValue = quality / 100;
        }

        const dataUrl = canvas.toDataURL(mimeType, qualityValue);
        setPreviewUrl(dataUrl);

        // ファイルサイズ推定
        const base64Length = dataUrl.split(',')[1].length;
        const sizeInBytes = (base64Length * 3) / 4;

        if (sizeInBytes < 1024) {
          setEstimatedSize(`${Math.round(sizeInBytes)} B`);
        } else if (sizeInBytes < 1024 * 1024) {
          setEstimatedSize(`${Math.round(sizeInBytes / 1024)} KB`);
        } else {
          setEstimatedSize(`${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`);
        }
      } catch (error) {
        console.error('Preview generation failed:', error);
        setPreviewUrl(image.src);
        setEstimatedSize('不明');
      } finally {
        setIsGenerating(false);
      }
    };

    generatePreview();
  }, [image, selectedFormat, quality]);

  const handleDownload = () => {
    onDownload(selectedFormat, quality);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      handleDownload();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー - 固定 */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              画像をダウンロード
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="ダイアログを閉じる"
            >
              <XMarkIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* スクロール可能なコンテンツエリア */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* プレビュー */}
            <div className="flex justify-center">
              <div className="relative">
                {isGenerating && (
                  <div className="absolute inset-0 bg-white dark:bg-slate-800 bg-opacity-75 flex items-center justify-center z-10">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <img
                  src={previewUrl || image.src}
                  alt="Download preview"
                  className="max-w-full max-h-48 object-contain border border-slate-200 dark:border-slate-600 rounded"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {/* 画像情報 */}
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <PhotoIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  画像情報
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">
                    サイズ
                  </span>
                  <span>
                    {image.width} × {image.height}px
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400">
                    推定ファイルサイズ
                  </span>
                  <span className="font-medium">{estimatedSize}</span>
                </div>
              </div>
            </div>

            {/* フォーマット選択 */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                ファイル形式
              </label>
              <div className="space-y-2">
                {formatOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`
                      flex items-start p-3 border rounded-lg cursor-pointer transition-colors
                      ${
                        selectedFormat === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={option.value}
                      checked={selectedFormat === option.value}
                      onChange={(e) =>
                        setSelectedFormat(e.target.value as DownloadFormat)
                      }
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {option.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 画質選択（JPEG/WebPのみ） */}
            {(selectedFormat === 'jpeg' || selectedFormat === 'webp') && (
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                  画質
                </label>
                <div className="space-y-2">
                  {qualityOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`
                        flex items-start p-3 border rounded-lg cursor-pointer transition-colors
                        ${
                          quality === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="quality"
                        value={option.value}
                        checked={quality === option.value}
                        onChange={(e) => setQuality(parseInt(e.target.value))}
                        className="mt-1 mr-3"
                      />
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {option.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {option.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* カスタム画質スライダー（JPEG/WebPのみ） */}
            {(selectedFormat === 'jpeg' || selectedFormat === 'webp') && (
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  カスタム画質: {quality}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>低画質</span>
                  <span>高画質</span>
                </div>
              </div>
            )}

            {/* ヘルプテキスト */}
            <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
              <p>Enter: ダウンロード / Esc: キャンセル</p>
            </div>
          </div>

          {/* 固定フッター - アクションボタン */}
          <div className="flex space-x-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              ダウンロード
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              キャンセル
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DownloadDialog;
