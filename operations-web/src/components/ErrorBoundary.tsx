import React from 'react';

type State = { error: Error | null };

/** Shows what broke instead of a blank page, so an admin can report it and reload. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Admin web crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8F4] p-6">
        <div className="max-w-lg w-full rounded-2xl border border-[#F8D2D0] bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-[#1C2B20]">Trang gặp lỗi</h1>
          <p className="mt-1 text-sm text-[#66756B]">Chụp lại nội dung bên dưới gửi đội kỹ thuật, rồi bấm Tải lại.</p>
          <pre className="mt-4 max-h-60 overflow-auto rounded-xl bg-[#FDF3F2] p-3 text-xs text-[#B9403A] whitespace-pre-wrap">
            {error.message}
            {'\n'}
            {error.stack?.split('\n').slice(1, 6).join('\n')}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2.5 rounded-xl bg-[#2E7D4A] text-white text-sm font-semibold"
          >
            Tải lại
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
