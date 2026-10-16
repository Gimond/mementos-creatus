import type { OverlayFrame, OverlayImageState, OverlayPlacement } from './types';

interface Point {
    x: number;
    y: number;
}

// Rectangle occupé par l'illustration (avant découpe par le cadre), en coordonnées du canvas
export const getOverlayRect = (overlay: OverlayImageState, frame: OverlayFrame) => {
    const {image, offsetX, offsetY, scale} = overlay;

    // Taille de base : l'image entière tient dans le cadre en conservant ses proportions
    const fitRatio = Math.min(frame.width / image.width, frame.height / image.height);
    const width = image.width * fitRatio * scale;
    const height = image.height * fitRatio * scale;
    const centerX = frame.x + frame.width / 2 + offsetX;
    const centerY = frame.y + frame.height / 2 + offsetY;

    return {x: centerX - width / 2, y: centerY - height / 2, width, height, centerX, centerY};
};

// Le point est-il sur la partie visible de l'illustration ?
export const isPointOnOverlay = (point: Point, overlay: OverlayImageState, frame: OverlayFrame) => {
    if (!overlay.isLoaded) return false;

    const rect = getOverlayRect(overlay, frame);
    const inRect = point.x >= rect.x && point.x <= rect.x + rect.width
        && point.y >= rect.y && point.y <= rect.y + rect.height;
    const inFrame = point.x >= frame.x && point.x <= frame.x + frame.width
        && point.y >= frame.y && point.y <= frame.y + frame.height;
    return inRect && inFrame;
};

// Le centre de l'image reste dans le cadre pour qu'on puisse toujours la rattraper
export const clampOffset = (offsetX: number, offsetY: number, frame: OverlayFrame) => ({
    offsetX: Math.max(-frame.width / 2, Math.min(frame.width / 2, offsetX)),
    offsetY: Math.max(-frame.height / 2, Math.min(frame.height / 2, offsetY)),
});

// Zoom centré sur le point visé : ce point reste sous le curseur
export const zoomAt = (
    overlay: OverlayImageState,
    frame: OverlayFrame,
    point: Point,
    factor: number,
    [minScale, maxScale]: [number, number]
): OverlayPlacement => {
    const scale = Math.max(minScale, Math.min(maxScale, overlay.scale * factor));
    const ratio = scale / overlay.scale;
    const {centerX, centerY} = getOverlayRect(overlay, frame);

    const newCenterX = point.x - (point.x - centerX) * ratio;
    const newCenterY = point.y - (point.y - centerY) * ratio;

    return {
        scale,
        ...clampOffset(
            newCenterX - (frame.x + frame.width / 2),
            newCenterY - (frame.y + frame.height / 2),
            frame
        ),
    };
};
