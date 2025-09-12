/**
 * Toast Notification Service
 * Provides user-friendly notifications for service degradations
 */

export enum ToastType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success'
}

export interface ToastNotification {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  dismissible?: boolean;
  timestamp: number;
}

export interface ToastConfig {
  defaultDuration: number;
  maxToasts: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export class ToastNotificationService {
  private toasts: ToastNotification[] = [];
  private listeners: ((toasts: ToastNotification[]) => void)[] = [];
  private config: ToastConfig;

  constructor(config: Partial<ToastConfig> = {}) {
    this.config = {
      defaultDuration: 4000, // 4 seconds
      maxToasts: 3,
      position: 'top-right',
      ...config
    };
  }

  show(message: string, type: ToastType = ToastType.INFO, duration?: number): string {
    const id = this.generateId();
    const toast: ToastNotification = {
      id,
      type,
      message,
      duration: duration ?? this.config.defaultDuration,
      dismissible: true,
      timestamp: Date.now()
    };

    // Add toast to the beginning of the array
    this.toasts.unshift(toast);

    // Limit number of toasts
    if (this.toasts.length > this.config.maxToasts) {
      this.toasts = this.toasts.slice(0, this.config.maxToasts);
    }

    // Auto-dismiss after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, toast.duration);
    }

    this.notifyListeners();
    return id;
  }

  dismiss(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  dismissAll(): void {
    this.toasts = [];
    this.notifyListeners();
  }

  getToasts(): ToastNotification[] {
    return [...this.toasts];
  }

  onToastsChange(listener: (toasts: ToastNotification[]) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.toasts]);
      } catch (error) {
        console.error('Error in toast notification listener:', error);
      }
    });
  }

  private generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Predefined messages for common degradation scenarios
  showVoiceQualityReduced(): string {
    return this.show(
      'Audio quality temporarily reduced for better performance',
      ToastType.WARNING,
      3000
    );
  }

  showMemoryServiceUnavailable(): string {
    return this.show(
      'Memory temporarily unavailable - using session only',
      ToastType.INFO,
      3000
    );
  }

  showExpressionsDisabled(): string {
    return this.show(
      'Voice expressions temporarily disabled',
      ToastType.INFO,
      2500
    );
  }

  showStreamingFallback(): string {
    return this.show(
      'Using backup audio system',
      ToastType.INFO,
      2500
    );
  }

  showServiceRestored(): string {
    return this.show(
      'All services restored',
      ToastType.SUCCESS,
      2000
    );
  }

  showConnectionIssue(): string {
    return this.show(
      'Connection issue detected - retrying...',
      ToastType.WARNING,
      3000
    );
  }

  showServiceTemporarilyUnavailable(): string {
    return this.show(
      'Service temporarily unavailable - please try again',
      ToastType.ERROR,
      4000
    );
  }
}

// Global toast notification service instance
export const toastNotificationService = new ToastNotificationService();