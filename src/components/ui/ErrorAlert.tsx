interface ErrorAlertProps {
    message: string;
  }
  
  export function ErrorAlert({ message }: ErrorAlertProps) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        {message}
      </div>
    );
  }