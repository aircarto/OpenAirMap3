import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "warning" | "error" | "success" | "info";
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onClose }) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 200); // Durée de l'animation de sortie
  }, [onClose, toast.id]);

  useEffect(() => {
    // Animation d'entrée
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleClose]);

  const variantStyles = {
    default: "bg-white border-gray-200 text-gray-900",
    warning:
      "bg-amber-50 border-amber-300 text-amber-900 shadow-amber-100/50",
    error: "bg-red-50 border-red-300 text-red-900 shadow-red-100/50",
    success: "bg-green-50 border-green-300 text-green-900 shadow-green-100/50",
    info: "bg-blue-50 border-blue-300 text-blue-900 shadow-blue-100/50",
  };

  const iconColors = {
    default: "text-gray-500",
    warning: "text-amber-600",
    error: "text-red-600",
    success: "text-green-600",
    info: "text-blue-600",
  };

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300",
        variantStyles[toast.variant || "default"],
        isVisible && !isLeaving
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0",
        "min-w-[320px] max-w-[400px]"
      )}
      role="alert"
    >
      {/* Icône */}
      <div className={cn("flex-shrink-0", iconColors[toast.variant || "default"])}>
        {toast.variant === "warning" && (
          <svg
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {toast.variant === "error" && (
          <svg
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {toast.variant === "success" && (
          <svg
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {(!toast.variant || toast.variant === "default" || toast.variant === "info") && (
          <svg
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm opacity-90">{toast.description}</p>
        )}
        {toast.action && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={toast.action.onClick}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                toast.variant === "warning" &&
                  "bg-amber-100 text-amber-900 hover:bg-amber-200",
                toast.variant === "error" &&
                  "bg-red-100 text-red-900 hover:bg-red-200",
                toast.variant === "success" &&
                  "bg-green-100 text-green-900 hover:bg-green-200",
                (!toast.variant || toast.variant === "default" || toast.variant === "info") &&
                  "bg-gray-100 text-gray-900 hover:bg-gray-200"
              )}
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      {/* Bouton de fermeture */}
      <button
        onClick={handleClose}
        className={cn(
          "flex-shrink-0 rounded-md p-1 transition-colors hover:bg-black/5",
          iconColors[toast.variant || "default"]
        )}
        aria-label={t("common.close")}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onClose,
}) => {
  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};



