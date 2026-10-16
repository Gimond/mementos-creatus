import React, {useEffect, useId, useRef, useState} from 'react';
import {BsChevronDown} from 'react-icons/bs';

interface Props {
    label: string;
    icon?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

// Bouton qui ouvre un panneau, refermé par un clic à l'extérieur ou la touche Échap
export const Dropdown: React.FC<Props> = ({label, icon, className, children}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelId = useId();

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div className={`dropdown ${className ?? ''}`} ref={containerRef}>
            <button
                className="btn btn-ghost btn-small"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen(current => !current)}
            >
                {icon}
                {label}
                <BsChevronDown className="dropdown-chevron"/>
            </button>
            {open && (
                <div className="dropdown-panel" id={panelId}>
                    {children}
                </div>
            )}
        </div>
    );
};
