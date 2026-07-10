import { InputHTMLAttributes, forwardRef } from 'react';
import { Check, AlertCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  showValidation?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, showValidation = true, className = '', ...props }, ref) => {
    const hasError = !!error;
    const hasValue = !!props.value;
    const showSuccess = showValidation && hasValue && !hasError && !props.disabled;

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={`
              w-full px-3 py-2 border rounded-md text-sm text-gray-900
              placeholder-gray-400 transition-all duration-200
              focus:outline-none focus:ring-2 focus:border-transparent
              ${hasError
                ? 'border-red-300 bg-red-50/50 focus:ring-red-500'
                : showSuccess
                  ? 'border-green-300 bg-green-50/30 focus:ring-green-500'
                  : 'border-gray-300 bg-white hover:border-gray-400 focus:ring-blue-500'
              }
              ${showSuccess || hasError ? 'pr-9' : ''}
              ${className}
            `}
            {...props}
          />
          {showSuccess && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
          )}
          {hasError && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
          )}
        </div>
        {error && <p className="text-xs text-red-600 flex items-center gap-1">{error}</p>}
        {helpText && !error && <p className="text-xs text-gray-500">{helpText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

