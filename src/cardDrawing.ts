// Dessin du mémento sur le canvas : fonctions pures, sans état React
import { withoutAccents } from './text';
import { getOverlayRect } from './overlay';
import type { Field, FoldLayout, OverlayFrame, OverlayImageState, Separator, TextStyle } from './types';

export interface CardScene {
    width: number;
    height: number;
    background: HTMLImageElement | null;
    fold: FoldLayout;
    overlayImage: OverlayImageState;
    overlayFrame: OverlayFrame;
    separators: Separator[];
    fields: Field[];
    playerLabel: string;
    playerLabelStyle: TextStyle;
}

const EDITOR_SEPARATOR_COLOR = '#e2caa7';

const buildFont = (fontSize: number, fontFamily: string, bold = false, italic = false) => {
    let fontStyle = '';
    if (bold) fontStyle += 'bold ';
    if (italic) fontStyle += 'italic ';
    return `${fontStyle}${fontSize}px ${fontFamily}`;
};

// Dessine le fond en ajustant la largeur du pli : les bandes unies du pli sont étirées
// et tout ce qui est au-dessus remonte, la partie MJ et la hauteur totale ne bougent pas
const drawBackground = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    {offset, stretchZones}: FoldLayout,
    width: number,
    height: number
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
        const destHeight = segment.end - segment.start + segment.extra;
        ctx.drawImage(
            image,
            0, sourceStart * scaleY, image.width, (segment.end - sourceStart) * scaleY,
            0, destY, width, destHeight
        );
        destY += destHeight;
        sourceStart = segments[index + 1]?.start ?? segment.end;
    });
};

// Dessine l'illustration dans son cadre, retournée pour être lisible côté joueurs
const drawOverlayImage = (ctx: CanvasRenderingContext2D, overlay: OverlayImageState, frame: OverlayFrame) => {
    const {width, height, centerX, centerY} = getOverlayRect(overlay, frame);

    ctx.save();

    // L'image ne doit pas déborder du cadre
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.width, frame.height);
    ctx.clip();

    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI);
    ctx.drawImage(overlay.image, -width / 2, -height / 2, width, height);

    ctx.restore();
};

// Texte sur une ligne, éventuellement retourné, réduit s'il dépasse style.maxWidth
const drawText = (ctx: CanvasRenderingContext2D, text: string, x: number, style: TextStyle) => {
    const {y, fontFamily, color, maxWidth, rotate = 0} = style;
    let {fontSize} = style;

    if (fontFamily === 'Rodfat') {
        text = withoutAccents(text);
    }

    ctx.textAlign = style.textAlign ?? 'left';
    ctx.font = buildFont(fontSize, fontFamily);
    ctx.fillStyle = color;

    const textWidth = ctx.measureText(text).width;
    if (maxWidth && textWidth > maxWidth) {
        fontSize = Math.floor(fontSize * maxWidth / textWidth);
        ctx.font = buildFont(fontSize, fontFamily);
    }

    ctx.save();
    ctx.translate(x, y);

    if (rotate !== 0) {
        // Pivot autour du milieu de la hauteur du texte
        let shiftX = 0;
        if (ctx.textAlign === 'left') shiftX = ctx.measureText(text).width;
        if (ctx.textAlign === 'right') shiftX = -ctx.measureText(text).width;
        ctx.translate(shiftX, -fontSize / 2);
        ctx.rotate(Math.PI / 180 * rotate);
    }

    ctx.fillText(text, 0, 0);
    ctx.restore();
};

// Champ d'une ligne, précédé de son libellé en gras quand le fond n'en prévoit pas
const drawField = (ctx: CanvasRenderingContext2D, value: string, style: TextStyle) => {
    let x = style.x;
    if (style.caption) {
        ctx.textAlign = 'left';
        ctx.font = buildFont(style.fontSize, style.fontFamily, true);
        ctx.fillStyle = style.captionColor ?? style.color;
        ctx.fillText(style.caption, x, style.y);
        x += ctx.measureText(style.caption).width + style.fontSize * 0.4;
    }

    drawText(ctx, (style.prefix ?? '') + value, x, style);
};

type TextSegment = { text: string, bold: boolean, italic: boolean };
type RichTextToken = TextSegment | 'br' | 'hr';

// Le HTML de l'éditeur est fait de <div> et <br> ; une ligne ne contenant que "---" devient un séparateur
const normalizeEditorHtml = (html: string) => html
    .replace(/\n/g, '<br/>')
    .replace(/<br>/g, '<br/>')
    .replace(/^<div>/, '')
    .replace(/<div>\s*<br\/>\s*<\/div>/g, '<br/>')
    .replace(/<div>/g, '<br/>')
    .replace(/<\/div>/g, '')
    .replace(/<br\/>\s*---\s*<br\/>/g, '<hr/><br/>')
    .replace(/^\s*---\s*(<br\/>|$)/, '<hr/>$1')
    .replace(/<br\/>\s*---\s*$/, '<br/><hr/>');

const collectTokens = (node: Node, bold: boolean, italic: boolean, tokens: RichTextToken[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
        tokens.push({text: node.textContent ?? '', bold, italic});
        return;
    }
    if (!(node instanceof HTMLElement)) return;

    if (node.tagName === 'BR') {
        tokens.push('br');
    } else if (node.tagName === 'HR') {
        tokens.push('hr');
    } else {
        const childBold = bold || node.tagName === 'B' || node.tagName === 'STRONG';
        const childItalic = italic || node.tagName === 'I' || node.tagName === 'EM';
        node.childNodes.forEach(child => collectTokens(child, childBold, childItalic, tokens));
    }
};

// Texte enrichi (gras, italique, séparateurs) avec retour à la ligne automatique.
// Retourne l'ordonnée de la dernière ligne dessinée.
const drawRichText = (ctx: CanvasRenderingContext2D, html: string, style: TextStyle, maxWidth: number) => {
    const {x, fontSize, fontFamily, color} = style;
    const lineHeight = 1.3 * fontSize;

    const container = document.createElement('div');
    container.innerHTML = normalizeEditorHtml(html);
    const tokens: RichTextToken[] = [];
    container.childNodes.forEach(child => collectTokens(child, false, false, tokens));

    ctx.textAlign = 'left';
    let y = style.y;
    let lastLineY = y;
    let lineWidth = 0;
    let line: TextSegment[] = [];

    const flushLine = () => {
        ctx.fillStyle = color;
        let segmentX = x;
        for (const segment of line) {
            ctx.font = buildFont(fontSize, fontFamily, segment.bold, segment.italic);
            ctx.fillText(segment.text, segmentX, y);
            segmentX += ctx.measureText(segment.text).width;
        }
        lastLineY = y;
        line = [];
        lineWidth = 0;
    };

    for (const token of tokens) {
        if (token === 'hr') {
            if (line.length > 0) {
                flushLine();
                y += lineHeight;
            }
            ctx.fillStyle = EDITOR_SEPARATOR_COLOR;
            ctx.fillRect(x, y - 5, maxWidth, 1);
            y += 5;
            lineWidth = 0;
            continue;
        }

        if (token === 'br') {
            if (line.length > 0) flushLine();
            y += lineHeight;
            lineWidth = 0;
            continue;
        }

        const words = token.text.split(' ');
        words.forEach((word, index) => {
            const text = index < words.length - 1 ? word + ' ' : word;
            ctx.font = buildFont(fontSize, fontFamily, token.bold, token.italic);
            const wordWidth = ctx.measureText(text).width;

            if (lineWidth + wordWidth > maxWidth) {
                flushLine();
                y += lineHeight;
            }
            line.push({...token, text});
            lineWidth += wordWidth;
        });
    }

    if (line.length > 0) flushLine();
    return lastLineY;
};

// Dessine tout le mémento. Retourne true si le texte libre dépasse sa zone.
export const drawCard = (ctx: CanvasRenderingContext2D, scene: CardScene): boolean => {
    const {width, height, background, fold, overlayImage, overlayFrame, separators, fields} = scene;

    ctx.clearRect(0, 0, width, height);

    if (background) {
        drawBackground(ctx, background, fold, width, height);
    }

    if (overlayImage.isLoaded) {
        drawOverlayImage(ctx, overlayImage, overlayFrame);
    }

    // Traits de séparation propres au modèle
    separators.forEach(separator => {
        ctx.fillStyle = separator.color;
        ctx.fillRect(separator.x, separator.y, separator.width, 1);
    });

    let textOverflow = false;
    fields.forEach(field => {
        field.style.forEach(style => {
            if (style.hideWhenEmpty && field.value.trim() === '') return;

            if (field.type === 'editor') {
                const lastLineY = drawRichText(ctx, field.value, style, style.maxWidth ?? width - 2 * style.x);
                if (lastLineY > (style.maxY ?? height)) {
                    textOverflow = true;
                }
            } else {
                drawField(ctx, field.value, style);
            }
        });
    });

    // Intitulé côté joueurs, retourné
    drawText(ctx, scene.playerLabel, scene.playerLabelStyle.x, scene.playerLabelStyle);

    return textOverflow;
};
