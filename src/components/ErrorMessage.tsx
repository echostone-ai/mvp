interface ErrorMessageProps {
  message: string
  onRetry?: () => void
  type?: 'error' | 'warning' | 'info'
}

export default function ErrorMessage({ message, onRetry, type = 'error' }: ErrorMessageProps) {
  const typeClasses = {
    error: 'status-error',
    warning: 'status-warning', 
    info: 'status-info'
  }

  const icons = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }

  return (
    <div className={`${typeClasses[type]} flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <span>{icons[type]}</span>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="ml-4 px-3 py-1 bg-white bg-opacity-20 rounded-md text-sm font-medium hover:bg-opacity-30 transition-all"
        >
          Try Again
        </button>
      )}
    </div>
  )
}