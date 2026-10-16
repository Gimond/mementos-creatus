import React, { useEffect, useRef } from 'react';
import FontFaceObserver from 'fontfaceobserver';
import { withoutAccents } from './text';
import { clampOffset, getOverlayRect, isPointOnOverlay, zoomAt } from './overlay';
import type { CanvasRendererProps, FoldLayout, OverlayFrame, OverlayImageState } from './types';

// Constantes
const FONT_LOAD_TIMEOUT = 5000;

const buildFont = (fontSize: number, fontFamily: string, bold = false, italic = false) => {
    let fontStyle = '';
    if (bold) fontStyle += 'bold ';
    if (italic) fontStyle += 'italic ';
    return `${fontStyle}${fontSize}px ${fontFamily}`;
};

const CanvasRenderer: React.FC<CanvasRendererProps> = ({
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
                                                           onCanvasReady,
                                                           onTextOverflow,
                                                           width,
                                                           height
                                                       }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [backgroundImage, setBackgroundImage] = React.useState<HTMLImageElement | null>(null);
    const [fontsLoaded, setFontsLoaded] = React.useState(false);

    // Fonctions de dessin
    // Retourne l'ordonnée de la dernière ligne dessinée
    const drawHtmlText = (
        ctx: CanvasRenderingContext2D,
        htmlContent: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        fontSize: number,
        fontFamily: string,
        color: string
    ): number => {
        ctx.textAlign = 'left';
        let currentY = y;
        let lastLineY = y;

        type TextSegment = {
            text: string;
            bold: boolean;
            italic: boolean;
            isLineBreak?: boolean;
            isSeparator?: boolean;
        };

        // Fonction helper pour dessiner une ligne
        const drawLine = (
            segments: { text: string, bold: boolean, italic: boolean }[],
            startX: number,
            lineY: number
        ) => {
            let posX = startX;
            ctx.fillStyle = color;
            lastLineY = lineY;

            for (const segment of segments) {
                ctx.font = buildFont(fontSize, fontFamily, segment.bold, segment.italic);

                ctx.fillText(segment.text, posX, lineY);
                posX += ctx.measureText(segment.text).width;
            }
        };

        const drawSeparatorLine = (lineY: number) => {
            const separatorHeight = 1;
            const separatorWidth = maxWidth;
            const separatorX = x + (maxWidth - separatorWidth) / 2;

            ctx.save();
            ctx.fillStyle = '#e2caa7';
            ctx.fillRect(separatorX, lineY - 5, separatorWidth, separatorHeight);
            ctx.restore();

            return lineY + 5;
        };


        // Fonction pour parser et dessiner le texte HTML
        const parseAndDrawHtml = (html: string) => {
            // Normalisation du HTML
            html = html.replace(/\n/g, '<br/>')
                .replace(/<br>/g, '<br/>')
                .replace(/^<div>/g, '')
                .replace(/<div>[\s\n]*<br\/>[\s\n]*<\/div>/g, '<br/>')
                .replace(/<div>/g, '<br/>')
                .replace(/<\/div>/g, '')
                .replace(/<div>/g, '');

            // Détecter les lignes qui contiennent uniquement "---"
            html = html.replace(/<br\/>\s*---\s*<br\/>/g, '<hr/><br/>');
            html = html.replace(/^\s*---\s*<br\/>/g, '<hr/><br/>');
            html = html.replace(/<br\/>\s*---\s*$/g, '<br/><hr/>');
            if (html === '---') {
                html = '<hr/>';
            }

            // Créer un élément temporaire pour parser l'HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // Extraire le texte et les balises
            const textNodes: TextSegment[] = [];

            const parseNode = (node: Node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    textNodes.push({
                        text: node.textContent || '',
                        bold: false,
                        italic: false
                    });
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement;

                    if (element.tagName === 'BR') {
                        textNodes.push({
                            text: '',
                            bold: false,
                            italic: false,
                            isLineBreak: true
                        });
                    } else if (element.tagName === 'HR') {
                        textNodes.push({
                            text: '',
                            bold: false,
                            italic: false,
                            isSeparator: true
                        });
                    } else if (element.tagName === 'B' || element.tagName === 'STRONG') {
                        Array.from(element.childNodes).forEach(childNode => {
                            if (childNode.nodeType === Node.TEXT_NODE) {
                                textNodes.push({
                                    text: childNode.textContent || '',
                                    bold: true,
                                    italic: false
                                });
                            } else {
                                parseNode(childNode);
                            }
                        });
                    } else if (element.tagName === 'I' || element.tagName === 'EM') {
                        Array.from(element.childNodes).forEach(childNode => {
                            if (childNode.nodeType === Node.TEXT_NODE) {
                                textNodes.push({
                                    text: childNode.textContent || '',
                                    bold: false,
                                    italic: true
                                });
                            } else {
                                parseNode(childNode);
                            }
                        })
                    } else {
                        Array.from(element.childNodes).forEach(parseNode);
                    }
                }
            };

            Array.from(tempDiv.childNodes).forEach(parseNode);

            // Dessiner le texte formaté avec retour à la ligne
            let currentX = x;
            let line: { text: string, bold: boolean, italic: boolean }[] = [];

            for (const segment of textNodes) {
                if (segment.isSeparator) {
                    if (line.length > 0) {
                        drawLine(line, x, currentY);
                        currentY += lineHeight;
                        line = [];
                    }
                    currentY = drawSeparatorLine(currentY);
                    currentX = x;
                    continue;
                }

                if (segment.isLineBreak) {
                    if (line.length > 0) {
                        drawLine(line, x, currentY);
                    }
                    currentY += lineHeight;
                    line = [];
                    currentX = x;
                    continue;
                }

                // Diviser en mots
                const words = segment.text.split(' ');

                for (let i = 0; i < words.length; i++) {
                    const word = words[i];
                    const space = i < words.length - 1 ? ' ' : '';
                    const wordWithSpace = word + space;

                    ctx.font = buildFont(fontSize, fontFamily, segment.bold, segment.italic);

                    const wordWidth = ctx.measureText(wordWithSpace).width;

                    if (currentX + wordWidth > x + maxWidth) {
                        drawLine(line, x, currentY);
                        currentY += lineHeight;
                        line = [];
                        currentX = x;
                        line.push({ text: wordWithSpace, bold: segment.bold, italic: segment.italic });
                        currentX += wordWidth;
                    } else {
                        line.push({ text: wordWithSpace, bold: segment.bold, italic: segment.italic });
                        currentX += wordWidth;
                    }
                }
            }

            if (line.length > 0) {
                drawLine(line, x, currentY);
                currentY += lineHeight;
            }
        };

        parseAndDrawHtml(htmlContent);
        return lastLineY;
    };

    // Dessine le fond en ajustant la largeur du pli : les bandes unies du pli sont étirées
    // et tout ce qui est au-dessus remonte, la partie MJ et la hauteur totale ne bougent pas
    const drawBackground = (
        ctx: CanvasRenderingContext2D,
        image: HTMLImageElement,
        {offset, stretchZones}: FoldLayout
    ) => {
        const scaleY = image.height / height;
        const stretch = offset / stretchZones.length;

        // Segments [début, fin] du fond (coordonnées du canvas) et hauteur supplémentaire de chacun
        const segments: { start: number, end: number, extra: number }[] = [];
        let cursor = 0;
        stretchZones.forEach(([start, end]) => {
            segments.push({start: cursor, end: start, extra: 0});
            segments.push({start, end, extra: stretch});
            cursor = end;
        });
        segments.push({start: cursor, end: height, extra: 0});

        // Le haut de la carte est rogné (ou étiré si le pli est réduit) pour compenser
        segments[0].extra = -offset;
        let sourceStart = Math.max(0, offset);

        let destY = 0;
        segments.forEach((segment, index) => {
            const sourceEnd = segment.end;
            const destHeight = segment.end - segment.start + segment.extra;
            ctx.drawImage(
                image,
                0, sourceStart * scaleY, image.width, (sourceEnd - sourceStart) * scaleY,
                0, destY, width, destHeight
            );
            destY += destHeight;
            sourceStart = segments[index + 1]?.start ?? sourceEnd;
        });
    };

    // Dessine l'illustration dans son cadre, retournée pour être lisible côté joueurs
    const drawOverlayImage = (
        ctx: CanvasRenderingContext2D,
        overlay: OverlayImageState,
        frame: OverlayFrame,
        angle: number
    ) => {
        const {width: drawWidth, height: drawHeight, centerX, centerY} = getOverlayRect(overlay, frame);

        ctx.save();

        // L'image ne doit pas déborder du cadre
        ctx.beginPath();
        ctx.rect(frame.x, frame.y, frame.width, frame.height);
        ctx.clip();

        ctx.translate(centerX, centerY);
        ctx.rotate(angle * Math.PI / 180);

        ctx.drawImage(
            overlay.image,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        ctx.restore();
    };

    const drawRotatedText = (
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        rotate: number,
        fontSize: number,
        textAlign: CanvasTextAlign | undefined,
        fontFamily: string,
        color: string,
        maxWidth?: number
    ): void => {
        if (fontFamily === 'Rodfat') {
            text = withoutAccents(text);
        }

        ctx.textAlign = textAlign ?? 'left';
        ctx.font = buildFont(fontSize, fontFamily);
        ctx.fillStyle = color;

        // Réduire la police si le texte dépasse de son cadre
        const textWidth = ctx.measureText(text).width;
        if (maxWidth && textWidth > maxWidth) {
            fontSize = Math.floor(fontSize * maxWidth / textWidth);
            ctx.font = buildFont(fontSize, fontFamily);
        }

        ctx.save();
        ctx.translate(x, y);

        if (rotate !== 0) {
            if (ctx.textAlign === 'center') {
                ctx.translate(0, fontSize / 2 * -1);
            } else if (ctx.textAlign === 'left') {
                ctx.translate(ctx.measureText(text).width, fontSize / 2 * -1);
            } else if (ctx.textAlign === 'right') {
                ctx.translate(-ctx.measureText(text).width, fontSize / 2 * -1);
            } else {
                ctx.translate(0, fontSize / 2 * -1);
            }
            ctx.rotate(Math.PI / 180 * rotate);
        }

        ctx.fillText(text, 0, 0);
        ctx.restore();
    };

    // Fonction principale pour dessiner le canvas
    const drawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (!fontsLoaded) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Effacer le canvas
        ctx.clearRect(0, 0, width, height);

        // Dessiner l'image de fond
        if (backgroundImage) {
            drawBackground(ctx, backgroundImage, fold);
        }

        // Dessiner l'image superposée
        if (overlayImage.isLoaded) {
            drawOverlayImage(ctx, overlayImage, overlayFrame, 180);
        }

        // Traits de séparation propres au modèle
        separators.forEach(separator => {
            ctx.fillStyle = separator.color;
            ctx.fillRect(separator.x, separator.y, separator.width, 1);
        });

        // Dessiner les textes
        let textOverflow = false;
        if (fontsLoaded) {
            fields.forEach(field => {
                field.style.forEach(style => {
                    if (style.hideWhenEmpty && field.value.trim() === '') {
                        return;
                    }

                    if (field.type === 'editor') {
                        const lastLineY = drawHtmlText(
                            ctx,
                            field.value,
                            style.x,
                            style.y,
                            style.maxWidth ?? width - 2 * style.x,
                            1.3 * style.fontSize,
                            style.fontSize,
                            style.fontFamily,
                            style.color
                        );
                        if (lastLineY > (style.maxY ?? height)) {
                            textOverflow = true;
                        }
                    } else {
                        let x = style.x;
                        if (style.caption) {
                            ctx.textAlign = 'left';
                            ctx.font = buildFont(style.fontSize, style.fontFamily, true);
                            ctx.fillStyle = style.captionColor ?? style.color;
                            ctx.fillText(style.caption, x, style.y);
                            x += ctx.measureText(style.caption).width + style.fontSize * 0.4;
                        }

                        drawRotatedText(
                            ctx,
                            (style.prefix ?? '') + field.value,
                            x,
                            style.y,
                            style.rotate ?? 0,
                            style.fontSize,
                            style.textAlign,
                            style.fontFamily,
                            style.color,
                            style.maxWidth
                        );
                    }
                });
            });

            // Intitulé côté joueurs, retourné
            drawRotatedText(
                ctx,
                playerLabel,
                playerLabelStyle.x,
                playerLabelStyle.y,
                playerLabelStyle.rotate ?? 0,
                playerLabelStyle.fontSize,
                playerLabelStyle.textAlign,
                playerLabelStyle.fontFamily,
                playerLabelStyle.color,
                playerLabelStyle.maxWidth
            );
        }

        onTextOverflow?.(textOverflow);
    };

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

    // Chargement des polices
    useEffect(() => {
        const fonts = [
            new FontFaceObserver('Rodfat'),
            new FontFaceObserver('SourceSans3'),
            new FontFaceObserver('SourceSans3', {weight: 700}),
            new FontFaceObserver('SourceSans3', {style: 'italic'}),
            new FontFaceObserver('SourceSans3', {weight: 700, style: 'italic'}),
        ];

        Promise.all(fonts.map(font => font.load(null, FONT_LOAD_TIMEOUT)))
            .then(() => {
                console.log('Polices chargées !');
                setFontsLoaded(true);
            })
            .catch(err => {
                console.error('Erreur lors du chargement des polices:', err);
                setFontsLoaded(true); // On continue même en cas d'erreur
            });
    }, []);

    // Mise à jour du canvas lors des changements
    useEffect(() => {
        drawCanvas();
    }, [fields, playerLabel, playerLabelStyle, overlayImage, overlayFrame, fold, separators, backgroundImage, fontsLoaded]);

    // Fournir la référence du canvas au parent si nécessaire
    useEffect(() => {
        if (onCanvasReady) {
            onCanvasReady(canvasRef as React.RefObject<HTMLCanvasElement>);
        }
    }, [canvasRef, onCanvasReady]);

    // Déplacement et zoom de l'illustration à la souris
    const dragStart = useRef<{ x: number, y: number, offsetX: number, offsetY: number } | null>(null);

    const toCanvasPoint = (e: { clientX: number, clientY: number }) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * canvas.width / rect.width,
            y: (e.clientY - rect.top) * canvas.height / rect.height,
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const point = toCanvasPoint(e);
        if (!onOverlayChange || !isPointOnOverlay(point, overlayImage, overlayFrame)) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        dragStart.current = {...point, offsetX: overlayImage.offsetX, offsetY: overlayImage.offsetY};
        e.currentTarget.style.cursor = 'grabbing';
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const point = toCanvasPoint(e);
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
            const point = toCanvasPoint(e);
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

export default CanvasRenderer;