import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import FontFaceObserver from 'fontfaceobserver';
import { drawCard } from './cardDrawing';
import { clampOffset, isPointOnOverlay, zoomAt } from './overlay';
import type { CanvasRendererProps } from './types';

const FONT_LOAD_TIMEOUT = 5000;

const CanvasRenderer: React.FC<CanvasRendererProps> = ({
                                                           ref,
                                                           fields,
                                                           playerLabel,
                                                           playerLabelStyle,
                                                           overlayImage,
                                                           overlayFrame,
                                                           overlayScaleRange,
                                                           onOverlayChange,
                                                           fold,
                                                           backgroundSrc,
                                                           separators,
                                                           onTextOverflow,
                                                           width,
                                                           height
                                                       }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
    const [fontsLoaded, setFontsLoaded] = useState(false);

    // Le parent accède au canvas pour le téléchargement
    useImperativeHandle(ref, () => canvasRef.current!, []);

    // Chargement de l'image de fond, l'ancienne reste affichée jusqu'à ce que la nouvelle soit prête
    useEffect(() => {
        let cancelled = false;
        const img = new Image();
        img.src = backgroundSrc;
        img.onload = () => {
            if (!cancelled) setBackgroundImage(img);
        };
        return () => {
            cancelled = true;
        };
    }, [backgroundSrc]);

    // Chargement des polices, le dessin attend qu'elles soient prêtes
    useEffect(() => {
        const fonts = [
            new FontFaceObserver('Rodfat'),
            new FontFaceObserver('SourceSans3'),
            new FontFaceObserver('SourceSans3', {weight: 700}),
            new FontFaceObserver('SourceSans3', {style: 'italic'}),
            new FontFaceObserver('SourceSans3', {weight: 700, style: 'italic'}),
        ];

        Promise.all(fonts.map(font => font.load(null, FONT_LOAD_TIMEOUT)))
            .catch(err => console.error('Erreur lors du chargement des polices :', err))
            .finally(() => setFontsLoaded(true));
    }, []);

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !fontsLoaded) return;

        const textOverflow = drawCard(ctx, {
            width,
            height,
            background: backgroundImage,
            fold,
            overlayImage,
            overlayFrame,
            separators,
            fields,
            playerLabel,
            playerLabelStyle,
        });
        onTextOverflow?.(textOverflow);
    }, [width, height, backgroundImage, fold, overlayImage, overlayFrame, separators, fields, playerLabel,
        playerLabelStyle, fontsLoaded, onTextOverflow]);

    // Déplacement et zoom de l'illustration à la souris
    const dragStart = useRef<{ x: number, y: number, offsetX: number, offsetY: number } | null>(null);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const point = toCanvasPoint(e.currentTarget, e);
        if (!onOverlayChange || !isPointOnOverlay(point, overlayImage, overlayFrame)) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        dragStart.current = {...point, offsetX: overlayImage.offsetX, offsetY: overlayImage.offsetY};
        e.currentTarget.style.cursor = 'grabbing';
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const point = toCanvasPoint(e.currentTarget, e);
        const start = dragStart.current;

        if (start) {
            onOverlayChange?.(clampOffset(
                start.offsetX + point.x - start.x,
                start.offsetY + point.y - start.y,
                overlayFrame
            ));
        } else {
            const hover = onOverlayChange && isPointOnOverlay(point, overlayImage, overlayFrame);
            e.currentTarget.style.cursor = hover ? 'grab' : '';
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!dragStart.current) return;
        dragStart.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        e.currentTarget.style.cursor = 'grab';
    };

    // La molette n'agit que sur l'image : ailleurs, la page défile normalement.
    // L'écouteur est natif car React enregistre "wheel" en passif, ce qui empêche preventDefault.
    const wheelState = useRef({overlayImage, overlayFrame, overlayScaleRange, onOverlayChange});
    useEffect(() => {
        wheelState.current = {overlayImage, overlayFrame, overlayScaleRange, onOverlayChange};
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
            const {overlayImage, overlayFrame, overlayScaleRange, onOverlayChange} = wheelState.current;
            const point = toCanvasPoint(canvas, e);
            if (!onOverlayChange || !isPointOnOverlay(point, overlayImage, overlayFrame)) return;

            e.preventDefault();
            const factor = Math.exp(-e.deltaY * 0.0015);
            onOverlayChange(zoomAt(overlayImage, overlayFrame, point, factor, overlayScaleRange));
        };

        canvas.addEventListener('wheel', handleWheel, {passive: false});
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="image-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        />
    );
};

// Position de la souris en coordonnées du canvas (qui est affiché réduit)
const toCanvasPoint = (canvas: HTMLCanvasElement, e: { clientX: number, clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * canvas.width / rect.width,
        y: (e.clientY - rect.top) * canvas.height / rect.height,
    };
};

export default CanvasRenderer;
