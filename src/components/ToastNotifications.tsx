'use client';

import React, { useEffect, useState } from 'react';
import { 
  ToastNotification, 
  ToastType, 
  toastNotificationService 
} from '../lib/services/toastNotificationService';

interface ToastNotificationsProps {
  className?: string;
}

export function ToastNotifications({ className = '' }: ToastNotificationsProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  useEffect(() => {
    // Subscribe to toast changes
    const unsubscribe = toastNotificationService.onToastsChange(setToasts);
    
    // Get initial toasts
    setToasts(toastNotificationService.getToasts());

    return unsubscribe;
  }, []);

  const handleDismiss = (id: string) => {
    toastNotificationService.dismiss(id);
  };

  const getToastIcon = (type: ToastType): string => {
    switch (type) {
      case ToastType.SUCCESS:
        return '✓';
      case ToastType.ERROR:
        return '✕';
      case ToastType.WARNING:
        return '⚠';
      case ToastType.INFO:
      default:
        return 'ℹ';
    }
  };

  const getToastStyles = (type: ToastType): string => {
    const baseStyles = 'flex items-center gap-3 p-4 rounded-lg shadow-lg border-l-4 backdrop-blur-sm transition-all duration-300 ease-in-out transform';
    
    switch (type) {
      case ToastType.SUCCESS:
        return `${baseStyles} bg-green-50/90 border-green-500 text-green-800`;
      case ToastType.ERROR:
        return `${baseStyles} bg-red-50/90 border-red-500 text-red-800`;
      case ToastType.WARNING:
        return `${baseStyles} bg-yellow-50/90 border-yellow-500 text-yellow-800`;
      case ToastType.INFO:
      default:
        return `${baseStyles} bg-blue-50/90 border-blue-500 text-blue-800`;
    }
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} animate-slide-in-right`}
          style={{
            animationDelay: `${index * 100}ms`
          }}
        >
          <div className="flex-shrink-0 text-lg">
            {getToastIcon(toast.type)}
          </div>
          
          <div className="flex-1 text-sm font-medium">
            {toast.message}
          </div>
          
          {toast.dismissible && (
            <button
              onClick={() => handleDismiss(toast.id)}
              className="flex-shrink-0 ml-2 text-lg hover:opacity-70 transition-opacity"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// CSS for animations (add to globals.css or component styles)
export const toastStyles = `
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out forwards;
  }
`;