import React from 'react';

/**
 * Validates password strength according to security standards:
 * - At least 8 characters long
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&*...)
 */
export const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const errors = [];
  if (!minLength) errors.push('at least 8 characters');
  if (!hasUpper) errors.push('1 uppercase letter (A-Z)');
  if (!hasLower) errors.push('1 lowercase letter (a-z)');
  if (!hasNumber) errors.push('1 number (0-9)');
  if (!hasSpecial) errors.push('1 special character (!@#$%^&*)');

  if (errors.length > 0) {
    return {
      isValid: false,
      message: `Password must include: ${errors.join(', ')}.`,
      checks: { minLength, hasUpper, hasLower, hasNumber, hasSpecial },
    };
  }

  return {
    isValid: true,
    message: 'Strong password!',
    checks: { minLength: true, hasUpper: true, hasLower: true, hasNumber: true, hasSpecial: true },
  };
};

/**
 * UI Component displaying password requirements and real-time status checklist
 */
export const PasswordRequirements = ({ password = '' }) => {
  const checks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'One number (0-9)', met: /[0-9]/.test(password) },
    { label: 'One special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="mt-2 p-3 bg-surface border border-line rounded-lg text-xs space-y-1.5">
      <p className="font-semibold text-ink-soft mb-1">Password Requirements:</p>
      {checks.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold ${item.met ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
            {item.met ? '✓' : '•'}
          </span>
          <span className={item.met ? 'text-emerald-700 font-medium' : 'text-ink-faint'}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};
