import { useState, useCallback } from 'react';

export type ValidationRule = (value: string, allValues?: Record<string, string>) => string | undefined;

export interface ValidationRules {
  [field: string]: ValidationRule[];
}

export function useFormValidation(
  initialValues: Record<string, string>,
  rules: ValidationRules
) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (field: string, value: string, allValues?: Record<string, string>): string | undefined => {
      const fieldRules = rules[field];
      if (!fieldRules) return undefined;
      const currentValues = allValues || values;
      for (const rule of fieldRules) {
        const error = rule(value, currentValues);
        if (error) return error;
      }
      return undefined;
    },
    [rules, values]
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, string | undefined> = {};
    let isValid = true;

    for (const field of Object.keys(rules)) {
      const error = validateField(field, values[field] || '', values);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    const allTouched: Record<string, boolean> = {};
    Object.keys(rules).forEach((f) => (allTouched[f] = true));
    setTouched(allTouched);
    return isValid;
  }, [rules, values, validateField]);

  const handleChange = useCallback(
    (field: string, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }));

      setErrors((prev) => {
        if (!touched[field]) return prev;
        const error = validateField(field, value, { ...values, [field]: value });
        return { ...prev, [field]: error };
      });
    },
    [touched, validateField, values]
  );

  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, values[field] || '', values);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [validateField, values]
  );

  const setFieldValue = useCallback(
    (field: string, value: string) => {
      handleChange(field, value);
    },
    [handleChange]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    setFieldValue,
    setValues,
    reset,
  };
}

export const validators = {
  required: (message = 'To pole jest wymagane'): ValidationRule =>
    (value) => (!value || !value.trim() ? message : undefined),

  email: (message = 'Podaj prawidłowy adres email'): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : message;
    },

  minLength: (min: number, message?: string): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      return value.length < min ? message || `Minimum ${min} znaków` : undefined;
    },

  maxLength: (max: number, message?: string): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      return value.length > max ? message || `Maksimum ${max} znaków` : undefined;
    },

  number: (message = 'Podaj prawidłową liczbę'): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      return isNaN(Number(value)) ? message : undefined;
    },

  positiveNumber: (message = 'Wartość musi być dodatnia'): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      const num = Number(value);
      if (isNaN(num)) return 'Podaj prawidłową liczbę';
      return num < 0 ? message : undefined;
    },

  price: (message = 'Podaj prawidłową kwotę'): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      return /^\d+([.,]\d{1,2})?$/.test(value) ? undefined : message;
    },

  date: (message = 'Podaj prawidłową datę'): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      const date = new Date(value);
      return isNaN(date.getTime()) ? message : undefined;
    },

  dateNotFuture: (message = 'Data nie może być w przyszłości'): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      const date = new Date(value);
      if (isNaN(date.getTime())) return 'Podaj prawidłową datę';
      return date > new Date() ? message : undefined;
    },

  phone: (message = 'Podaj prawidłowy numer telefonu'): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      return /^[+]?[\d\s\-()]{7,20}$/.test(value) ? undefined : message;
    },

  alphanumeric: (message = 'Dozwolone tylko litery, cyfry, myślniki i ukośniki'): ValidationRule =>
    (value) => {
      if (!value) return undefined;
      return /^[a-zA-Z0-9\-_/.]+$/.test(value) ? undefined : message;
    },

  match: (otherField: string, message = 'Wartości nie są zgodne'): ValidationRule =>
    (value, allValues) => {
      if (!value) return undefined;
      return value !== allValues?.[otherField] ? message : undefined;
    },
};
