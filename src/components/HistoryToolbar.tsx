import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useImageContext } from '../context/ImageContext';

const HistoryToolbar: React.FC = () => {
  const { state, dispatch } = useImageContext();
  const { history, historyIndex } = state;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const currentStep = historyIndex + 1;
  const totalSteps = history.length;

  const handleUndo = () => {
    if (canUndo) {
      dispatch({ type: 'UNDO' });
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      dispatch({ type: 'REDO' });
    }
  };

  // 履歴が1つ以下の場合は表示しない
  if (totalSteps <= 1) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center space-x-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm px-2 py-1"
    >
      {/* Undo ボタン */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleUndo}
        disabled={!canUndo}
        className={`
          p-2 rounded-md transition-colors
          ${
            canUndo
              ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          }
        `}
        title={`元に戻す (Ctrl+Z) ${canUndo ? '' : '- 利用不可'}`}
        aria-label="元に戻す"
      >
        <ArrowUturnLeftIcon className="w-4 h-4" />
      </motion.button>

      {/* 履歴ステップ表示 */}
      <div className="flex items-center space-x-2 px-2">
        <ClockIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 min-w-[3rem] text-center">
          {currentStep}/{totalSteps}
        </span>
      </div>

      {/* Redo ボタン */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleRedo}
        disabled={!canRedo}
        className={`
          p-2 rounded-md transition-colors
          ${
            canRedo
              ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          }
        `}
        title={`やり直し (Ctrl+Shift+Z) ${canRedo ? '' : '- 利用不可'}`}
        aria-label="やり直し"
      >
        <ArrowUturnRightIcon className="w-4 h-4" />
      </motion.button>

      {/* 進捗バー */}
      <div className="w-16 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden ml-2">
        <motion.div
          className="h-full bg-blue-500 rounded-full"
          initial={{ width: 0 }}
          animate={{
            width: `${(currentStep / Math.max(totalSteps, 50)) * 100}%`,
          }}
          transition={{ duration: 0.2 }}
        />
      </div>

      {/* 最大ステップ警告 */}
      {totalSteps >= 45 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center space-x-1 text-xs text-amber-600 dark:text-amber-400"
        >
          <span>⚠️</span>
          <span>{50 - totalSteps}残り</span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default HistoryToolbar;
