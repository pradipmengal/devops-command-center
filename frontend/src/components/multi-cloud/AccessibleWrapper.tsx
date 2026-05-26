/**
 * AccessibleWrapper - Tasks 21.1-21.4
 * 
 * Accessibility utilities and wrapper components.
 * Provides ARIA labels, keyboard navigation, and screen reader support.
 * 
 * Requirements:
 *   - Requirement 16.1: ARIA labels on all interactive elements
 *   - Requirement 16.2: Keyboard navigation
 *   - Requirement 16.3: Screen reader announcements
 *   - Requirement 16.4: Focus management
 */

import React, { useEffect, useRef, useCallback } from 'react';

/**
 * LiveRegion - announces dynamic content changes to screen readers.
 * Usage: <LiveRegion message="5 services loaded" />
 */
export const LiveRegion = ({ message, politeness = 'polite', className = '' }) => (
  <div
    role="status"
    aria-live={politeness}
    aria-atomic="true"
    className={`sr-only ${className}`}
  >
    {message}
  </div>
);

/**
 * SkipLink - allows keyboard users to skip to main content.
 */
export const SkipLink = ({ targetId = 'main-content' }) => (
  <a
    href={`#${targetId}`}
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none"
  >
    Skip to main content
  </a>
);

/**
 * FocusTrap - traps focus within a container (for modals/dropdowns).
 */
export const FocusTrap = ({ children, active = true }) => {
  const containerRef = useRef(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus first element when trap activates
    const focusable = getFocusableElements();
    if (focusable.length > 0) focusable[0].focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, getFocusableElements]);

  return <div ref={containerRef}>{children}</div>;
};

/**
 * KeyboardNavigableList - adds arrow key navigation to a list.
 */
export const KeyboardNavigableList = ({
  children,
  onSelect,
  role = 'listbox',
  ariaLabel,
  className = ''
}) => {
  const listRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    const items = listRef.current?.querySelectorAll('[role="option"]') || [];
    const currentIndex = Array.from(items).indexOf(document.activeElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < items.length - 1) items[currentIndex + 1].focus();
        else items[0].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) items[currentIndex - 1].focus();
        else items[items.length - 1].focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (document.activeElement && onSelect) {
          onSelect(document.activeElement.dataset.value);
        }
        break;
      case 'Escape':
        listRef.current?.blur();
        break;
    }
  }, [onSelect]);

  return (
    <div
      ref={listRef}
      role={role}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={className}
    >
      {children}
    </div>
  );
};

/**
 * AccessibleButton - button with proper ARIA attributes.
 */
export const AccessibleButton = ({
  children,
  onClick,
  disabled = false,
  ariaLabel,
  ariaPressed,
  ariaExpanded,
  ariaControls,
  ariaDescribedBy,
  className = '',
  ...props
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    aria-pressed={ariaPressed}
    aria-expanded={ariaExpanded}
    aria-controls={ariaControls}
    aria-describedby={ariaDescribedBy}
    className={`focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent ${className}`}
    {...props}
  >
    {children}
  </button>
);

/**
 * AccessibleCheckbox - checkbox with proper label association.
 */
export const AccessibleCheckbox = ({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  description,
  className = ''
}) => (
  <div className={`flex items-start gap-3 ${className}`}>
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-describedby={description ? `${id}-desc` : undefined}
      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
    />
    <div>
      <label htmlFor={id} className="text-white text-sm cursor-pointer">
        {label}
      </label>
      {description && (
        <p id={`${id}-desc`} className="text-xs text-white/50 mt-0.5">
          {description}
        </p>
      )}
    </div>
  </div>
);

/**
 * AccessibleModal - modal with focus trap and escape key handling.
 */
export const AccessibleModal = ({
  isOpen,
  onClose,
  title,
  children,
  ariaDescribedBy
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={ariaDescribedBy}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content */}
      <FocusTrap active={isOpen}>
        <div className="relative bg-gray-900 border border-white/20 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
          <h2 id="modal-title" className="text-xl font-semibold text-white mb-4">
            {title}
          </h2>
          {children}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ✕
          </button>
        </div>
      </FocusTrap>
    </div>
  );
};

/**
 * useAnnounce - hook to announce messages to screen readers.
 */
export const useAnnounce = () => {
  const announce = useCallback((message, politeness = 'polite') => {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => document.body.removeChild(el), 1000);
  }, []);

  return announce;
};

export default {
  LiveRegion,
  SkipLink,
  FocusTrap,
  KeyboardNavigableList,
  AccessibleButton,
  AccessibleCheckbox,
  AccessibleModal,
  useAnnounce
};
