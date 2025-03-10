interface LoadingSpinnerProps {
    message?: string;
  }
  
  export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
        <span className="ml-2 text-gray-700">{message}</span>
      </div>
    );
  }