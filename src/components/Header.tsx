import React, { useState } from 'react';
import {
  CursorArrowRaysIcon,
  Squares2X2Icon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars3Icon,
  SunIcon,
  MoonIcon,
  ArrowDownTrayIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useImageContext } from '../context/ImageContext';
import BoardExportDialog from './BoardExportDialog';

const Header: React.FC = () => {
  const {
    state,
    setDragMode,
    undo,
    redo,
    toggleLayerSidebar,
    toggleDarkMode,
  } = useImageContext();

  const [showExportDialog, setShowExportDialog] = useState(false);

  // 履歴操作の可否
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  // 全画像書き出しダイアログを開く
  const handleExportAll = () => {
    setShowExportDialog(true);
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
      {/* 左側：アプリタイトルとモード切替 */}
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Image Canvas
        </h1>

        {/* 移動モード切替 */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          <button
            onClick={() => setDragMode('free')}
            className={`p-2 rounded-md transition-colors ${
              state.dragMode === 'free'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="フリーモード - 自由移動"
            aria-label="フリーモードに切り替え"
          >
            <CursorArrowRaysIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setDragMode('grid-snap')}
            className={`p-2 rounded-md transition-colors ${
              state.dragMode === 'grid-snap'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="グリッドスナップモード - ドラッグでグリッドに自動フィット"
            aria-label="グリッドスナップモードに切り替え"
          >
            <Squares2X2Icon className="w-5 h-5" />
          </button>

        </div>


      </div>

      {/* 中央：履歴ツールバー */}
      <div className="flex items-center space-x-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-2 rounded-md transition-colors ${
            canUndo
              ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
          title="元に戻す (Ctrl+Z / ⌘Z)"
          aria-label="元に戻す"
        >
          <ArrowUturnLeftIcon className="w-5 h-5" />
        </button>

        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-2 rounded-md transition-colors ${
            canRedo
              ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
          title="やり直し (Ctrl+Shift+Z / ⌘⇧Z)"
          aria-label="やり直し"
        >
          <ArrowUturnRightIcon className="w-5 h-5" />
        </button>

        {/* 履歴情報 */}
        {state.history.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded min-w-[4.5rem] text-center font-mono">
            {state.historyIndex + 1} / {state.history.length}
          </span>
        )}
      </div>

      {/* 右側：ユーティリティボタン */}
      <div className="flex items-center space-x-2">
        {/* 画像数表示 */}
        {state.images.length > 0 && (
          <div className="flex items-center space-x-1 text-sm text-slate-600 dark:text-slate-400">
            <EyeIcon className="w-4 h-4" />
            <span>{state.images.filter((img) => img.visible).length}</span>
            <span>/</span>
            <span>{state.images.length}</span>
          </div>
        )}

        {/* ボード全体書き出し */}
        <button
          onClick={handleExportAll}
          disabled={
            state.images.length === 0 ||
            state.images.filter((img) => img.visible).length === 0
          }
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            state.images.length > 0 &&
            state.images.filter((img) => img.visible).length > 0
              ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
              : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'
          }`}
          title="ボード全体を書き出し"
          aria-label="ボード全体書き出し"
        >
          <ArrowDownTrayIcon className="w-4 h-4 mr-1 inline" />
          書き出し
        </button>

        {/* レイヤーサイドバー切替 */}
        <button
          onClick={toggleLayerSidebar}
          className={`p-2 rounded-md transition-colors ${
            state.layerSidebarVisible
              ? 'bg-blue-500 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title="レイヤーサイドバー (L)"
          aria-label={`レイヤーサイドバー${state.layerSidebarVisible ? '非表示' : '表示'}`}
        >
          <Bars3Icon className="w-5 h-5" />
        </button>

        {/* ダークモード切替 */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={`${state.darkMode ? 'ライト' : 'ダーク'}モードに切り替え`}
          aria-label={`${state.darkMode ? 'ライト' : 'ダーク'}モードに切り替え`}
        >
          {state.darkMode ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* ボード全体書き出しダイアログ */}
      <BoardExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        totalImages={state.images.length}
        visibleImages={state.images.filter((img) => img.visible).length}
      />
    </header>
  );
};

export default Header;
 