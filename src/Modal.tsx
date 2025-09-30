import React, {useEffect} from 'react';
import './Modal.css'
import { SlClose } from "react-icons/sl";

interface Props {
    open: boolean;
    cancelFn?: () => void;
    primaryFn?: () => void;
    secondaryFn?: () => void;
    content?: React.ReactNode;
    titleContent?: React.ReactNode;
    className?: string;
}

export const Modal: React.FC<Props> = (props) => {
    const {open, cancelFn, primaryFn, secondaryFn, titleContent, content} = props;

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
                            <button onClick={cancelFn}>
                                <SlClose />
                            </button>
                        </div>
                    </div>
                )}

                <div className="body">
                    {content}
                </div>

                <div className="footer">
                    {secondaryFn && (
                        <button onClick={secondaryFn} id="cancelBtn">
                            Annuler
                        </button>
                    )}
                    {primaryFn && (
                        <button onClick={primaryFn}>
                            Importer
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
