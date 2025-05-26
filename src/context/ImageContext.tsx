import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { produce } from 'immer';
import {
  AppState,
  ImageItem,
  HistoryStep,
  HistoryAction,
  CropSelection,
  DragMode,
} from '../types';

// 初期状態
const initialState: AppState = {
  images: [],
  selectedImageId: null,
  dragMode: 'free',
  aspectRatioLocked: true,
  history: [],
  historyIndex: -1,
  cropState: {
    imageId: null,
    selection: null,
    isActive: false,
  },
  layerSidebarVisible: false,
  darkMode: false,
  isLoading: false,
};

// アクションタイプ
type Action =
  | { type: 'ADD_IMAGE'; payload: Omit<ImageItem, 'id' | 'zIndex'> }
  | { type: 'DELETE_IMAGE'; payload: string }
  | {
      type: 'UPDATE_IMAGE';
      payload: { id: string; updates: Partial<ImageItem> };
    }
  | { type: 'SELECT_IMAGE'; payload: string | null }
  | { type: 'SET_DRAG_MODE'; payload: DragMode }
  | { type: 'TOGGLE_ASPECT_RATIO_LOCK' }
  | { type: 'SET_ASPECT_RATIO_LOCK'; payload: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | {
      type: 'ADD_HISTORY_STEP';
      payload: { action: HistoryAction; description: string };
    }
  | { type: 'START_CROP'; payload: string }
  | { type: 'UPDATE_CROP_SELECTION'; payload: CropSelection }
  | { type: 'APPLY_CROP' }
  | { type: 'CANCEL_CROP' }
  | { type: 'REORDER_LAYER'; payload: { imageId: string; newZIndex: number } }
  | { type: 'TOGGLE_LAYER_VISIBILITY'; payload: string }
  | { type: 'TOGGLE_LAYER_SIDEBAR' }
  | { type: 'SET_LAYER_SIDEBAR'; payload: boolean }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'SET_DARK_MODE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'RESET_STATE' };

// ユニークIDの生成
const generateId = () =>
  `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 履歴ステップの作成
const createHistoryStep = (
  action: HistoryAction,
  description: string,
  images: ImageItem[]
): HistoryStep => ({
  id: generateId(),
  action,
  timestamp: Date.now(),
  description,
  images: JSON.parse(JSON.stringify(images)), // Deep copy
});

// リデューサー
const imageReducer = produce((draft: AppState, action: Action) => {
  switch (action.type) {
    case 'ADD_IMAGE': {
      // 重複チェック: 同じsrcの画像が最近追加されていないか確認（より緩い条件）
      const recentImages = draft.images.slice(-1); // 直前の1枚のみをチェック
      const now = Date.now();
      const isDuplicate = recentImages.some(
        img => {
          // 同じデータURLかつ50ms以内で完全に同じ位置の場合のみ重複とみなす
          const isVeryRecentDuplicate = 
            img.src === action.payload.src && 
            img.x === action.payload.x && 
            img.y === action.payload.y &&
            (now - parseInt(img.id.split('_')[1])) < 50; // 50ms以内
          
          if (isVeryRecentDuplicate) {
            console.warn('Very recent duplicate detected:', { 
              timeDiff: now - parseInt(img.id.split('_')[1]),
              coordinates: { x: img.x, y: img.y },
              newCoordinates: { x: action.payload.x, y: action.payload.y }
            });
          }
          
          return isVeryRecentDuplicate;
        }
      );

      if (isDuplicate) {
        console.warn('Duplicate image prevented:', action.payload.src.substring(0, 50) + '...');
        break;
      }

      const newImage: ImageItem = {
        ...action.payload,
        id: generateId(),
        zIndex: draft.images.length,
        aspectRatioLocked: draft.aspectRatioLocked,
      };

      draft.images.push(newImage);
      draft.selectedImageId = newImage.id;

      console.info(`✅ Image added successfully. Total images: ${draft.images.length}`, {
        id: newImage.id,
        size: `${newImage.width}×${newImage.height}`,
        position: `(${newImage.x}, ${newImage.y})`
      });

      // 履歴に追加
      const historyStep = createHistoryStep(
        'add-image',
        '画像を追加',
        draft.images
      );
      draft.history = draft.history.slice(0, draft.historyIndex + 1);
      draft.history.push(historyStep);
      draft.historyIndex = draft.history.length - 1;

      // 履歴の上限チェック
      if (draft.history.length > 100) {
        draft.history.shift();
        draft.historyIndex--;
      }
      break;
    }

    case 'DELETE_IMAGE': {
      const imageIndex = draft.images.findIndex(
        (img) => img.id === action.payload
      );
      if (imageIndex !== -1) {
        draft.images.splice(imageIndex, 1);

        if (draft.selectedImageId === action.payload) {
          draft.selectedImageId = null;
        }

        // z-indexを再調整
        draft.images.forEach((img, index) => {
          img.zIndex = index;
        });

        // 履歴に追加
        const historyStep = createHistoryStep(
          'delete-image',
          '画像を削除',
          draft.images
        );
        draft.history = draft.history.slice(0, draft.historyIndex + 1);
        draft.history.push(historyStep);
        draft.historyIndex = draft.history.length - 1;
      }
      break;
    }

    case 'UPDATE_IMAGE': {
      const imageIndex = draft.images.findIndex(
        (img) => img.id === action.payload.id
      );
      if (imageIndex !== -1) {
        Object.assign(draft.images[imageIndex], action.payload.updates);
      }
      break;
    }

    case 'SELECT_IMAGE':
      draft.selectedImageId = action.payload;
      break;

    case 'SET_DRAG_MODE':
      draft.dragMode = action.payload;
      break;

    case 'TOGGLE_ASPECT_RATIO_LOCK':
      draft.aspectRatioLocked = !draft.aspectRatioLocked;
      break;

    case 'SET_ASPECT_RATIO_LOCK':
      draft.aspectRatioLocked = action.payload;
      break;

    case 'UNDO': {
      if (draft.historyIndex > 0) {
        draft.historyIndex--;
        const step = draft.history[draft.historyIndex];
        draft.images = JSON.parse(JSON.stringify(step.images));
      }
      break;
    }

    case 'REDO': {
      if (draft.historyIndex < draft.history.length - 1) {
        draft.historyIndex++;
        const step = draft.history[draft.historyIndex];
        draft.images = JSON.parse(JSON.stringify(step.images));
      }
      break;
    }

    case 'ADD_HISTORY_STEP': {
      const historyStep = createHistoryStep(
        action.payload.action,
        action.payload.description,
        draft.images
      );
      draft.history = draft.history.slice(0, draft.historyIndex + 1);
      draft.history.push(historyStep);
      draft.historyIndex = draft.history.length - 1;

      // デバッグログ
      console.log(`📝 履歴追加: ${action.payload.description} (total: ${draft.history.length})`);

      if (draft.history.length > 100) {
        draft.history.shift();
        draft.historyIndex--;
      }
      break;
    }

    case 'START_CROP':
      draft.cropState.imageId = action.payload;
      draft.cropState.isActive = true;
      draft.cropState.selection = null;
      break;

    case 'UPDATE_CROP_SELECTION':
      draft.cropState.selection = action.payload;
      break;

    case 'APPLY_CROP': {
      if (draft.cropState.imageId && draft.cropState.selection) {
        const imageIndex = draft.images.findIndex(
          (img) => img.id === draft.cropState.imageId
        );
        if (imageIndex !== -1) {
          const image = draft.images[imageIndex];
          const selection = draft.cropState.selection;

          // 新しい画像サイズを計算
          image.width = selection.width;
          image.height = selection.height;
          image.x += selection.x;
          image.y += selection.y;

          // 履歴に追加
          const historyStep = createHistoryStep(
            'crop-image',
            '画像をトリミング',
            draft.images
          );
          draft.history = draft.history.slice(0, draft.historyIndex + 1);
          draft.history.push(historyStep);
          draft.historyIndex = draft.history.length - 1;
        }
      }

      draft.cropState.imageId = null;
      draft.cropState.selection = null;
      draft.cropState.isActive = false;
      break;
    }

    case 'CANCEL_CROP':
      draft.cropState.imageId = null;
      draft.cropState.selection = null;
      draft.cropState.isActive = false;
      break;

    case 'REORDER_LAYER': {
      const imageIndex = draft.images.findIndex(
        (img) => img.id === action.payload.imageId
      );
      if (imageIndex !== -1) {
        const oldZIndex = draft.images[imageIndex].zIndex;
        const newZIndex = action.payload.newZIndex;
        
        // zIndexを設定
        draft.images[imageIndex].zIndex = newZIndex;

        // 他の画像のzIndexを調整（並び替え）
        draft.images.forEach((img) => {
          if (img.id !== action.payload.imageId) {
            if (oldZIndex < newZIndex) {
              // 上に移動する場合、間にある画像を下げる
              if (img.zIndex <= newZIndex && img.zIndex > oldZIndex) {
                img.zIndex--;
              }
            } else {
              // 下に移動する場合、間にある画像を上げる
              if (img.zIndex >= newZIndex && img.zIndex < oldZIndex) {
                img.zIndex++;
              }
            }
          }
        });

        // zIndex値を0から連番に正規化
        const sortedImages = [...draft.images].sort((a, b) => a.zIndex - b.zIndex);
        sortedImages.forEach((img, index) => {
          img.zIndex = index;
        });

        // 履歴に追加
        const historyStep = createHistoryStep(
          'reorder-layer',
          'レイヤー順序を変更',
          draft.images
        );
        draft.history = draft.history.slice(0, draft.historyIndex + 1);
        draft.history.push(historyStep);
        draft.historyIndex = draft.history.length - 1;

        // 履歴の上限チェック
        if (draft.history.length > 100) {
          draft.history.shift();
          draft.historyIndex--;
        }
      }
      break;
    }

    case 'TOGGLE_LAYER_VISIBILITY': {
      const imageIndex = draft.images.findIndex(
        (img) => img.id === action.payload
      );
      if (imageIndex !== -1) {
        draft.images[imageIndex].visible = !draft.images[imageIndex].visible;

        // 履歴に追加
        const historyStep = createHistoryStep(
          'toggle-visibility',
          '表示/非表示を切替',
          draft.images
        );
        draft.history = draft.history.slice(0, draft.historyIndex + 1);
        draft.history.push(historyStep);
        draft.historyIndex = draft.history.length - 1;
      }
      break;
    }

    case 'TOGGLE_LAYER_SIDEBAR':
      draft.layerSidebarVisible = !draft.layerSidebarVisible;
      break;

    case 'SET_LAYER_SIDEBAR':
      draft.layerSidebarVisible = action.payload;
      break;

    case 'TOGGLE_DARK_MODE':
      draft.darkMode = !draft.darkMode;
      break;

    case 'SET_DARK_MODE':
      draft.darkMode = action.payload;
      break;

    case 'SET_LOADING':
      draft.isLoading = action.payload;
      break;

    case 'LOAD_STATE':
      Object.assign(draft, action.payload);
      break;

    case 'RESET_STATE':
      Object.assign(draft, initialState);
      break;
  }
});

// コンテキスト
interface ImageContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;

  // ヘルパー関数
  addImage: (image: Omit<ImageItem, 'id' | 'zIndex'>) => void;
  deleteImage: (id: string) => void;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
  selectImage: (id: string | null) => void;
  setDragMode: (mode: DragMode) => void;
  toggleAspectRatioLock: () => void;
  undo: () => void;
  redo: () => void;
  startCrop: (imageId: string) => void;
  updateCropSelection: (selection: CropSelection) => void;
  applyCrop: () => void;
  cancelCrop: () => void;
  reorderLayer: (imageId: string, newZIndex: number) => void;
  toggleLayerVisibility: (imageId: string) => void;
  toggleLayerSidebar: () => void;
  toggleDarkMode: () => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
}

const ImageContext = createContext<ImageContextType | undefined>(undefined);

// プロバイダー
export const ImageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(imageReducer, initialState);

  // LocalStorageからの読み込み（一時的に無効化して重複バグをテスト）
  useEffect(() => {
    // LocalStorageをクリアして新しい状態でテスト
    try {
      localStorage.removeItem('image-canvas-state');
      console.info('LocalStorage cleared for debugging');
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
    
    // 読み込みを一時的に無効化
    // const savedState = localStorage.getItem('image-canvas-state');
    // if (savedState) {
    //   try {
    //     const parsedState = JSON.parse(savedState);
    //     dispatch({ type: 'LOAD_STATE', payload: parsedState });
    //   } catch (error) {
    //     console.warn('Failed to load state from localStorage:', error);
    //   }
    // }
  }, []);

  // LocalStorageへの保存（一時的に無効化してデバッグ）
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      try {
        // 画像データを除外した軽量版を保存
        const lightState = {
          ...state,
          images: [], // 画像データは保存しない
        };
        localStorage.setItem('image-canvas-state', JSON.stringify(lightState));
        console.info('State saved to localStorage (without images)');
      } catch (error) {
        console.warn('Failed to save state to localStorage:', error);
        // ストレージクリアを試行
        try {
          localStorage.removeItem('image-canvas-state');
          console.info('Cleared localStorage due to save failure');
        } catch (clearError) {
          console.error('Failed to clear localStorage:', clearError);
        }
      }
    }, 1000); // 1秒後に保存（デバウンス）

    return () => clearTimeout(saveTimer);
  }, [state]);

  // ダークモードの適用
  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.darkMode]);

  // ヘルパー関数
  const contextValue: ImageContextType = {
    state,
    dispatch,

    addImage: (image) => dispatch({ type: 'ADD_IMAGE', payload: image }),
    deleteImage: (id) => dispatch({ type: 'DELETE_IMAGE', payload: id }),
    updateImage: (id, updates) =>
      dispatch({ type: 'UPDATE_IMAGE', payload: { id, updates } }),
    selectImage: (id) => dispatch({ type: 'SELECT_IMAGE', payload: id }),
    setDragMode: (mode) => dispatch({ type: 'SET_DRAG_MODE', payload: mode }),
    toggleAspectRatioLock: () => dispatch({ type: 'TOGGLE_ASPECT_RATIO_LOCK' }),
    undo: () => dispatch({ type: 'UNDO' }),
    redo: () => dispatch({ type: 'REDO' }),
    startCrop: (imageId) => dispatch({ type: 'START_CROP', payload: imageId }),
    updateCropSelection: (selection) =>
      dispatch({ type: 'UPDATE_CROP_SELECTION', payload: selection }),
    applyCrop: () => dispatch({ type: 'APPLY_CROP' }),
    cancelCrop: () => dispatch({ type: 'CANCEL_CROP' }),
    reorderLayer: (imageId, newZIndex) =>
      dispatch({ type: 'REORDER_LAYER', payload: { imageId, newZIndex } }),
    toggleLayerVisibility: (imageId) =>
      dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', payload: imageId }),
    toggleLayerSidebar: () => dispatch({ type: 'TOGGLE_LAYER_SIDEBAR' }),
    toggleDarkMode: () => dispatch({ type: 'TOGGLE_DARK_MODE' }),

    saveToLocalStorage: () => {
      localStorage.setItem('image-canvas-state', JSON.stringify(state));
    },

    loadFromLocalStorage: () => {
      const savedState = localStorage.getItem('image-canvas-state');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          dispatch({ type: 'LOAD_STATE', payload: parsedState });
        } catch (error) {
          console.warn('Failed to load state from localStorage:', error);
        }
      }
    },
  };

  return (
    <ImageContext.Provider value={contextValue}>
      {children}
    </ImageContext.Provider>
  );
};

// カスタムフック
export const useImageContext = () => {
  const context = useContext(ImageContext);
  if (context === undefined) {
    throw new Error('useImageContext must be used within an ImageProvider');
  }
  return context;
};
