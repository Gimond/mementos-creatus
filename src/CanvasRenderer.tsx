import React, { useEffect, useRef } from 'react';
import FontFaceObserver from 'fontfaceobserver';
import type { CanvasRendererProps } from './types';

// Constantes
const CANVAS_WIDTH = 535;
const CANVAS_HEIGHT = 1609;
const FONT_LOAD_TIMEOUT = 5000;

const CanvasRenderer: React.FC<CanvasRendererProps> = ({
                                                           fields,
                                                           overlayImage,
                                                           onCanvasReady,
                                                           width = CANVAS_WIDTH,
                                                           height = CANVAS_HEIGHT
                                                       }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [backgroundImage, setBackgroundImage] = React.useState<HTMLImageElement | null>(null);
    const [fontsLoaded, setFontsLoaded] = React.useState(false);

    // Fonctions de dessin
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

        type TextSegment = {
            text: string;
            bold: boolean;
            isLineBreak?: boolean;
            isSeparator?: boolean;
        };

        // Fonction helper pour dessiner une ligne
        const drawLine = (
            segments: { text: string, bold: boolean }[],
            startX: number,
            lineY: number
        ) => {
            let posX = startX;
            ctx.fillStyle = color;

            for (const segment of segments) {
                ctx.font = segment.bold
                    ? `bold ${fontSize}px ${fontFamily}`
                    : `${fontSize}px ${fontFamily}`;

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
                        bold: false
                    });
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement;

                    if (element.tagName === 'BR') {
                        textNodes.push({
                            text: '',
                            bold: false,
                            isLineBreak: true
                        });
                    } else if (element.tagName === 'HR') {
                        textNodes.push({
                            text: '',
                            bold: false,
                            isSeparator: true
                        });
                    } else if (element.tagName === 'B' || element.tagName === 'STRONG') {
                        Array.from(element.childNodes).forEach(childNode => {
                            if (childNode.nodeType === Node.TEXT_NODE) {
                                textNodes.push({
                                    text: childNode.textContent || '',
                                    bold: true
                                });
                            } else {
                                parseNode(childNode);
                            }
                        });
                    } else {
                        Array.from(element.childNodes).forEach(parseNode);
                    }
                }
            };

            Array.from(tempDiv.childNodes).forEach(parseNode);

            // Dessiner le texte formaté avec retour à la ligne
            let currentX = x;
            let line: { text: string, bold: boolean }[] = [];

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

                    ctx.font = segment.bold
                        ? `bold ${fontSize}px ${fontFamily}`
                        : `${fontSize}px ${fontFamily}`;

                    const wordWidth = ctx.measureText(wordWithSpace).width;

                    if (currentX + wordWidth > x + maxWidth) {
                        drawLine(line, x, currentY);
                        currentY += lineHeight;
                        line = [];
                        currentX = x;
                        line.push({ text: wordWithSpace, bold: segment.bold });
                        currentX += wordWidth;
                    } else {
                        line.push({ text: wordWithSpace, bold: segment.bold });
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
        return currentY;
    };

    const drawRotatedImage = (
        ctx: CanvasRenderingContext2D,
        image: HTMLImageElement,
        x: number,
        y: number,
        width: number,
        height: number,
        angle: number
    ) => {
        const containerWidth = 535;
        const containerHeight = 390;

        // Calcul du ratio d'aspect
        const imageAspectRatio = image.width / image.height;
        const containerAspectRatio = containerWidth / containerHeight;

        // Dimensions pour maintenir l'aspect ratio
        let drawWidth, drawHeight;

        if (imageAspectRatio > containerAspectRatio) {
            drawWidth = containerWidth;
            drawHeight = containerWidth / imageAspectRatio;
        } else {
            drawHeight = containerHeight;
            drawWidth = containerHeight * imageAspectRatio;
        }

        if (drawWidth > width) {
            drawWidth = width;
            drawHeight = drawWidth / imageAspectRatio;
        }
        if (drawHeight > height) {
            drawHeight = height;
            drawWidth = drawHeight * imageAspectRatio;
        }

        // Calculer les coordonnées pour centrer l'image
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;

        // Appliquer la transformation
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.translate(x, y);
        ctx.rotate(angle * Math.PI / 180);

        ctx.drawImage(
            image,
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
        color: string
    ): void => {
        if (fontFamily === 'Rodfat') {
            text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        }

        ctx.textAlign = textAlign ?? 'left';
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;

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
            ctx.drawImage(backgroundImage, 0, 0, width, height);
        }

        // Dessiner l'image superposée
        if (overlayImage.isLoaded) {
            drawRotatedImage(
                ctx,
                overlayImage.image,
                overlayImage.x,
                overlayImage.y,
                overlayImage.width,
                overlayImage.height,
                180
            );
        }

        // Dessiner les textes
        if (fontsLoaded) {
            fields.forEach(field => {
                field.style.forEach(style => {
                    if (field.type === 'editor') {
                        drawHtmlText(
                            ctx,
                            field.value,
                            style.x,
                            style.y,
                            470,
                            1.3 * style.fontSize,
                            style.fontSize,
                            style.fontFamily,
                            style.color
                        );
                    } else {
                        drawRotatedText(
                            ctx,
                            (style.prefix ?? '') + field.value,
                            style.x,
                            style.y,
                            style.rotate ?? 0,
                            style.fontSize,
                            style.textAlign,
                            style.fontFamily,
                            style.color
                        );
                    }
                });
            });
        }
    };

    // Chargement initial des ressources
    useEffect(() => {
        // Chargement de l'image de fond
        const img = new Image();
        img.src = '/background.png';
        img.onload = () => {
            setBackgroundImage(img);
        };

        // Chargement des polices
        const rodfatFont = new FontFaceObserver('Rodfat');
        const ikariusFont = new FontFaceObserver('Ikarius');

        Promise.all([
            rodfatFont.load(null, FONT_LOAD_TIMEOUT),
            ikariusFont.load(null, FONT_LOAD_TIMEOUT)
        ])
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
    }, [fields, overlayImage, backgroundImage, fontsLoaded]);

    // Fournir la référence du canvas au parent si nécessaire
    useEffect(() => {
        if (onCanvasReady) {
            onCanvasReady(canvasRef as React.RefObject<HTMLCanvasElement>);
        }
    }, [canvasRef, onCanvasReady]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="image-canvas"
        />
    );
};

export default CanvasRenderer;