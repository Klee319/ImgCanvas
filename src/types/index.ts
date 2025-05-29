// 画像オブジェクトの型定義
export interface ImageItem {
  id: string;
  src: string; // Base64 データURL
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  zIndex: number;
  visible: boolean;
  aspectRatioLocked: boolean;
  rotation?: number;
  opacity?: number;
}

// 移動モードの型定義
export type DragMode = 'free' | 'grid-snap';

// 履歴アクションの型定義
export type HistoryAction =
  | 'add-image'
  | 'delete-image'
  | 'move-image'
  | 'resize-image'
  | 'crop-image'
  | 'reorder-layer'
  | 'toggle-visibility'
  | 'toggle-aspect-ratio'
  | 'multiple-changes';

// 履歴ステップの型定義
export interface HistoryStep {
  id: string;
  action: HistoryAction;
  timestamp: number;
  description: string;
  images: ImageItem[];
}

// トリミング範囲の型定義
export interface CropSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

// トリミング状態の型定義
export interface CropState {
  imageId: string | null;
  selection: CropSelection | null;
  isActive: boolean;
}

// リサイズハンドルの位置
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

// ダウンロード形式の型定義
export type DownloadFormat = 'png' | 'jpeg' | 'webp';

// ダウンロードオプションの型定義
export interface DownloadOptions {
  format: DownloadFormat;
  quality: number; // 0.6, 0.8, 1.0
}

// レイヤー情報の型定義
export interface LayerInfo {
  id: string;
  name: string;
  thumbnail: string;
  visible: boolean;
  zIndex: number;
}

// アプリケーション状態の型定義
export interface AppState {
  images: ImageItem[];
  selectedImageId: string | null;
  dragMode: DragMode;
  aspectRatioLocked: boolean; // グローバル設定
  history: HistoryStep[];
  historyIndex: number;
  cropState: CropState;
  layerSidebarVisible: boolean;
  darkMode: boolean;
  isLoading: boolean;
}

// コンテキストメニューのアイテム
export interface ContextMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

// キーボードショートカットの型定義
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

// エクスポート設定の型定義
export interface ExportSettings {
  format: 'png' | 'jpeg' | 'webp';
  quality: number;
  includeBackground: boolean;
  backgroundColor: string;
  scale: number;
}

// ファイルサイズ情報
export interface FileSizeInfo {
  size: number;
  unit: 'B' | 'KB' | 'MB';
  formatted: string;
}

// エラー情報
export interface ErrorInfo {
  message: string;
  type: 'clipboard' | 'file' | 'memory' | 'export' | 'general';
  timestamp: number;
}

// パフォーマンス統計
export interface PerformanceStats {
  renderTime: number;
  memoryUsage: number;
  imageCount: number;
  historySize: number;
}
 