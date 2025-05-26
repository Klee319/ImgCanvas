import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_: Error): Partial<State> {
    // 次のレンダリングでフォールバック UI が表示されるように state を更新
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // エラーの詳細をログに記録
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReload = (): void => {
    // 状態をリセット
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // ページをリロード
    window.location.reload();
  };

  handleReset = (): void => {
    // 状態をリセット
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // ローカルストレージをクリア
    try {
      localStorage.removeItem('imageCanvas-state');
      console.info('Local storage cleared due to error recovery');
    } catch (err) {
      console.warn('Failed to clear local storage:', err);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // フォールバック UI
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-lg w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                アプリケーションエラー
              </h2>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              申し訳ございません。予期しないエラーが発生しました。以下のオプションをお試しください。
            </p>
            
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                データをリセットして続行
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md transition-colors"
              >
                ページを再読み込み
              </button>
            </div>
            
            {/* 開発環境でのエラー詳細表示 */}
            {(import.meta as any).env.MODE === 'development' && this.state.error && (
              <details className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                <summary className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  エラー詳細 (開発環境のみ)
                </summary>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                  <p><strong>Error:</strong> {this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="mt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 