import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface NoticeProps {
  message: string | null;
  error?: boolean;
  onClose?: () => void;
}

export function Notice({ message, error, onClose }: NoticeProps) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (message) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message || !visible) return null;

  return (
    <div className="notice-toast-container">
      <div className={`notice-toast ${error ? 'error' : ''}`}>
        <div className="notice-icon-box">
          {error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        </div>
        <div style={{ flex: 1, fontWeight: 500 }}>
          {message}
        </div>
        <button
          className="quiet"
          style={{ padding: '4px', borderRadius: '8px', marginLeft: '8px' }}
          onClick={() => {
            setVisible(false);
            if (onClose) onClose();
          }}
          type="button"
          aria-label="Đóng"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
