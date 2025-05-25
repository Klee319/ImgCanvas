import React, { useState, useCallback } from 'react';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useExport } from '../hooks/useExport';
import type { ExportSettings } from '../types';

interface BoardExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  totalImages: number;
  visibleImages: number;
}

const BoardExportDialog: React.FC<BoardExportDialogProps> = ({
  isOpen,
  onClose,
  totalImages,
  visibleImages,
}) => {
  const { exportAllImages, isExporting, exportProgress } = useExport();

  const [settings, setSettings] = useState<ExportSettings>({
    format: 'png',
    quality: 1.0,
    includeBackground: true,
    backgroundColor: '#ffffff',
    scale: 1,
  });

  const [showSuccess, setShowSuccess] = useState(false);

  // エクスポート実行
  const handleExport = useCallback(async () => {
    try {
      await exportAllImages(settings);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      // エラーハンドリング（必要に応じて）
    }
  }, [exportAllImages, settings, onClose]);

  // ダイアログを閉じる
  const handleClose = useCallback(() => {
    if (!isExporting) {
      onClose();
    }
  }, [isExporting, onClose]);

  // 品質プリセット
  const qualityPresets = [
    { label: '高品質', value: 1.0, description: '最高画質（ファイルサイズ大）' },
    { label: '標準', value: 0.8, description: 'バランス良好' },
    { label: '圧縮', value: 0.6, description: 'ファイルサイズ小' },
  ];

  // スケールオプション
  const scaleOptions = [
    { label: '100%', value: 1 },
    { label: '150%', value: 1.5 },
    { label: '200%', value: 2 },
    { label: '300%', value: 3 },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                ボード全体を書き出し
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
                <EyeIcon className="w-4 h-4" />
                <span>{visibleImages}枚表示中</span>
                {totalImages > visibleImages && (
                  <>
                    <EyeSlashIcon className="w-4 h-4" />
                    <span>{totalImages - visibleImages}枚非表示</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isExporting}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* コンテンツ */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* フォーマット選択 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                ファイル形式
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['png', 'jpeg', 'webp'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setSettings({ ...settings, format })}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      settings.format === format
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* 品質設定（JPEG/WebPのみ） */}
            {(settings.format === 'jpeg' || settings.format === 'webp') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  画質
                </label>
                <div className="space-y-2">
                  {qualityPresets.map((preset) => (
                    <label key={preset.value} className="flex items-center">
                      <input
                        type="radio"
                        name="quality"
                        value={preset.value}
                        checked={settings.quality === preset.value}
                        onChange={() =>
                          setSettings({ ...settings, quality: preset.value })
                        }
                        className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
                      />
                      <span className="ml-3 text-sm text-slate-700 dark:text-slate-300">
                        {preset.label}
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {preset.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* スケール設定 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                書き出しサイズ
              </label>
              <div className="grid grid-cols-2 gap-2">
                {scaleOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSettings({ ...settings, scale: option.value })}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      settings.scale === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 背景オプション */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.includeBackground}
                  onChange={(e) =>
                    setSettings({ ...settings, includeBackground: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded"
                />
                <span className="ml-3 text-sm text-slate-700 dark:text-slate-300">
                  背景色を含める
                </span>
              </label>

              {settings.includeBackground && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(e) =>
                      setSettings({ ...settings, backgroundColor: e.target.value })
                    }
                    className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {settings.backgroundColor}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* フッター */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-700">
            {showSuccess ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center text-green-600 dark:text-green-400"
              >
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                <span className="font-medium">書き出し完了！</span>
              </motion.div>
            ) : isExporting ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">書き出し中...</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {Math.round(exportProgress)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleExport}
                  disabled={visibleImages === 0}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    visibleImages > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowDownTrayIcon className="w-4 h-4 mr-2 inline" />
                  書き出し
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BoardExportDialog; 