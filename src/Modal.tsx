import React, {useEffect} from 'react';
import './Modal.css'

interface Props {
    open: boolean;
    cancelFn?: () => void;
    primaryFn?: () => void;
    secondaryFn?: () => void;
    closeIcon?: string;
    content?: React.ReactNode;
    titleContent?: React.ReactNode;
    className?: string;
}

export const Modal: React.FC<Props> = (props) => {
    const {open, cancelFn, primaryFn, secondaryFn, closeIcon, titleContent, content} = props;

    // simple useEffect to capture ESC key to close the modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) {
                if (cancelFn) {
                    cancelFn();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, cancelFn]);


    if (!open) return null;

    return (
        <div className="modalBackground">
            <div className="modalContainer">
                {titleContent && (<div className="title">
                        {titleContent}
                        <div className="titleCloseBtn">
                            <button onClick={cancelFn}>{closeIcon ?? 'X'}</button>
                        </div>
                    </div>
                )}

                <div className="body">
                    {content}
                </div>

                <div className="footer">
                    {secondaryFn && (
                        <button onClick={secondaryFn} id="cancelBtn">
                            Cancel
                        </button>
                    )}
                    {primaryFn && (
                        <button onClick={primaryFn}>Continue</button>
                    )}
                </div>
            </div>
        </div>
    );
};
