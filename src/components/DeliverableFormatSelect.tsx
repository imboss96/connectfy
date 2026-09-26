import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface DeliverableFormatSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  label: string;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export const DeliverableFormatSelect: React.FC<DeliverableFormatSelectProps> = ({
  value,
  options,
  onChange,
  className = '',
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const desiredHeight = Math.min(256, options.length * 36 + 8);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding * 2);
      const spaceAbove = Math.max(0, rect.top - viewportPadding * 2);
      const openAbove = spaceBelow < Math.min(desiredHeight, 160) && spaceAbove > spaceBelow;
      const availableSpace = openAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(72, Math.min(desiredHeight, availableSpace || 72));
      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
      const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding));
      const proposedTop = openAbove ? rect.top - maxHeight - 4 : rect.bottom + 4;
      const top = Math.max(viewportPadding, Math.min(proposedTop, window.innerHeight - maxHeight - viewportPadding));

      setMenuPosition({ top, left, width, maxHeight });
    };

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node) || menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, options.length]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left ${className}`}
      >
        <span className="truncate">{value || 'Choose a file format'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && menuPosition && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={label}
          className="fixed z-[100] overflow-y-auto rounded-xl border border-slate-600 bg-[#0B132B] p-1 text-white shadow-2xl"
          style={{ ...menuPosition, overscrollBehavior: 'contain' }}
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${selected ? 'bg-[#007AFF]/20 text-sky-200' : 'text-slate-200 hover:bg-[#111C33]'}`}
              >
                <span>{option}</span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
