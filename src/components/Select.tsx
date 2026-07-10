import { SelectHTMLAttributes, forwardRef } from 'react';
import { Check, AlertCircle, ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  options: SelectOption[];
  placeholder?: string;
  showValidation?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helpText, showValidation = true, options, placeholder, className = '', ...props }, ref) => {
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
          <select
            ref={ref}
            className={`
              w-full pl-3 pr-9 py-2 border rounded-md text-sm text-gray-900
              transition-all duration-200 bg-white appearance-none cursor-pointer
              focus:outline-none focus:ring-2 focus:border-transparent
              ${hasError
                ? 'border-red-300 bg-red-50/50 focus:ring-red-500'
                : showSuccess
                  ? 'border-green-300 bg-green-50/30 focus:ring-green-500'
                  : 'border-gray-300 hover:border-gray-400 focus:ring-blue-500'
              }
              ${className}
            `}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
            {hasError ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : showSuccess ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
        {error && <p className="text-xs text-red-600 flex items-center gap-1">{error}</p>}
        {helpText && !error && <p className="text-xs text-gray-500">{helpText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
