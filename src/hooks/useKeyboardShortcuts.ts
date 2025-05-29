import { useEffect, useCallback } from 'react';
import { useImageContext } from '../context/ImageContext';
import { useExport } from './useExport';
import type { KeyboardShortcut } from '../types';

export const useKeyboardShortcuts = () => {
  const {
    undo,
    redo,
    toggleLayerSidebar,
    state,
    updateImage,
    reorderLayer,
    deleteImage,
    dispatch,
  } = useImageContext();
  
  const { copyImageToClipboard } = useExport();

  // 履歴操作のショートカット
  const handleHistoryShortcuts = useCallback(
    (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (!isCtrlOrCmd) return false;

      switch (event.key.toLowerCase()) {
        case 'z':
          if (event.shiftKey) {
            // Ctrl+Shift+Z / Cmd+Shift+Z でやり直し
            event.preventDefault();
            redo();
            return true;
          } else {
            // Ctrl+Z / Cmd+Z で元に戻す
            event.preventDefault();
            undo();
            return true;
          }
        default:
          return false;
      }
    },
    [undo, redo]
  );

  // レイヤー操作のショートカット
  const handleLayerShortcuts = useCallback(
    (event: KeyboardEvent) => {
      // アクティブなフォーカスがある場合はスキップ
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true')
      ) {
        return false;
      }

      switch (event.key.toLowerCase()) {
        case 'l':
          // Lキーでレイヤーサイドバーの表示/非表示
          event.preventDefault();
          toggleLayerSidebar();
          return true;

        case '[':
          // [キーで選択画像を背面へ
          if (state.selectedImageId) {
            event.preventDefault();
            const selectedImage = state.images.find(
              (img) => img.id === state.selectedImageId
            );
            if (selectedImage && selectedImage.zIndex > 0) {
              reorderLayer(state.selectedImageId, selectedImage.zIndex - 1);
            }
            return true;
          }
          return false;

        case ']':
          // ]キーで選択画像を前面へ
          if (state.selectedImageId) {
            event.preventDefault();
            const selectedImage = state.images.find(
              (img) => img.id === state.selectedImageId
            );
            const maxZIndex = Math.max(
              ...state.images.map((img) => img.zIndex),
              -1
            );
            if (selectedImage && selectedImage.zIndex < maxZIndex) {
              reorderLayer(state.selectedImageId, selectedImage.zIndex + 1);
            }
            return true;
          }
          return false;

        case 'delete':
        case 'backspace':
          // Delete/Backspaceキーで選択画像を削除
          if (state.selectedImageId) {
            event.preventDefault();
            deleteImage(state.selectedImageId);
            return true;
          }
          return false;

        default:
          return false;
      }
    },
    [
      toggleLayerSidebar,
      state.selectedImageId,
      state.images,
      reorderLayer,
      deleteImage,
    ]
  );

  // 画像操作のショートカット
  const handleImageShortcuts = useCallback(
    (event: KeyboardEvent) => {
      if (!state.selectedImageId) return false;

      // グリッドスナップモードの時はImageCanvasで処理するためスキップ
      if (state.dragMode === 'grid-snap') return false;

      const moveDistance = event.shiftKey ? 10 : 1; // Shiftで高速移動
      const selectedImage = state.images.find((img) => img.id === state.selectedImageId);
      if (!selectedImage) return false;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          updateImage(state.selectedImageId, {
            y: Math.max(0, selectedImage.y - moveDistance),
          });
          // 履歴に追加
          dispatch({
            type: 'ADD_HISTORY_STEP',
            payload: {
              action: 'move-image',
              description: '画像をキーボードで移動',
            },
          });
          return true;

        case 'ArrowDown':
          event.preventDefault();
          updateImage(state.selectedImageId, {
            y: selectedImage.y + moveDistance,
          });
          // 履歴に追加
          dispatch({
            type: 'ADD_HISTORY_STEP',
            payload: {
              action: 'move-image',
              description: '画像をキーボードで移動',
            },
          });
          return true;

        case 'ArrowLeft':
          event.preventDefault();
          updateImage(state.selectedImageId, {
            x: Math.max(0, selectedImage.x - moveDistance),
          });
          // 履歴に追加
          dispatch({
            type: 'ADD_HISTORY_STEP',
            payload: {
              action: 'move-image',
              description: '画像をキーボードで移動',
            },
          });
          return true;

        case 'ArrowRight':
          event.preventDefault();
          updateImage(state.selectedImageId, {
            x: selectedImage.x + moveDistance,
          });
          // 履歴に追加
          dispatch({
            type: 'ADD_HISTORY_STEP',
            payload: {
              action: 'move-image',
              description: '画像をキーボードで移動',
            },
          });
          return true;

        default:
          return false;
      }
    },
    [state.selectedImageId, state.images, state.dragMode, updateImage, dispatch]
  );

  // 全般的なアプリケーションショートカット
  const handleAppShortcuts = useCallback(async (event: KeyboardEvent) => {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;

    if (isCtrlOrCmd && event.key.toLowerCase() === 'c') {
      // Ctrl+C / Cmd+C で選択画像をクリップボードにコピー
      if (state.selectedImageId) {
        event.preventDefault();
        try {
          await copyImageToClipboard(state.selectedImageId);
          console.log('📋 Image copied to clipboard successfully');
        } catch (error) {
          console.error('Failed to copy image to clipboard:', error);
        }
        return true;
      }
      return false;
    }

    if (isCtrlOrCmd && event.key.toLowerCase() === 'a') {
      // Ctrl+A / Cmd+A で全選択（今後の実装用）
      event.preventDefault();
      // TODO: 複数選択機能の実装時に対応
      return true;
    }

    return false;
  }, [state.selectedImageId, copyImageToClipboard]);

  // メインのキーボードイベントハンドラー
  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      // 履歴操作を最優先でチェック
      if (handleHistoryShortcuts(event)) return;

      // アプリケーション全般のショートカット
      if (await handleAppShortcuts(event)) return;

      // レイヤー操作のショートカット
      if (handleLayerShortcuts(event)) return;

      // 画像操作のショートカット
      if (handleImageShortcuts(event)) return;
    },
    [
      handleHistoryShortcuts,
      handleAppShortcuts,
      handleLayerShortcuts,
      handleImageShortcuts,
    ]
  );

  // キーボードショートカットのマップ（ヘルプ表示用）
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'Ctrl+V / ⌘V',
      action: () => {},
      description: 'クリップボードから画像を貼り付け',
    },
    {
      key: 'Ctrl+C / ⌘C',
      action: () => {},
      description: '選択画像をクリップボードにコピー',
    },
    {
      key: 'Ctrl+Z / ⌘Z',
      action: undo,
      description: '元に戻す',
    },
    {
      key: 'Ctrl+Shift+Z / ⌘⇧Z',
      action: redo,
      description: 'やり直し',
    },
    {
      key: 'L',
      action: toggleLayerSidebar,
      description: 'レイヤーサイドバーの表示/非表示',
    },
    {
      key: '[',
      action: () => {},
      description: '選択画像を背面へ',
    },
    {
      key: ']',
      action: () => {},
      description: '選択画像を前面へ',
    },
    {
      key: 'Delete / Backspace',
      action: () => {},
      description: '選択画像を削除',
    },
    {
      key: '矢印キー',
      action: () => {},
      description: '選択画像を移動（Shift+矢印で高速移動）',
    },
  ];

  // ヘルプメッセージの生成
  const getShortcutHelp = useCallback(() => {
    return shortcuts
      .map((shortcut) => `${shortcut.key}: ${shortcut.description}`)
      .join('\n');
  }, [shortcuts]);

  // ショートカットが利用可能かどうかのチェック
  const isShortcutAvailable = useCallback((key: string) => {
    const activeElement = document.activeElement;
    const isInputFocused =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true');

    // テキスト入力中は一部のショートカットのみ利用可能
    if (isInputFocused) {
      return ['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+C', '⌘Z', '⌘⇧Z', '⌘C'].some((shortcut) =>
        shortcut.toLowerCase().includes(key.toLowerCase())
      );
    }

    return true;
  }, []);

  // イベントリスナーの設定
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    shortcuts,
    getShortcutHelp,
    isShortcutAvailable,
  };
};
 