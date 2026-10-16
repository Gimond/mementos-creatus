export interface TextStyle {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    textAlign?: CanvasTextAlign;
    rotate?: number;
    prefix?: string;
    editor?: boolean;
    wrapText?: boolean;
    maxWidth?: number;
    maxY?: number;
    hideWhenEmpty?: boolean;
    // Libellé en gras dessiné devant la valeur, quand le fond n'en prévoit pas
    caption?: string;
    captionColor?: string;
}

export interface Field {
    id: number;
    key: string;
    group: string;
    label: string;
    value: string;
    type: string;
    fieldSize?: string;
    style: TextStyle[];
    // Modèles de mémento où le champ apparaît (tous si absent)
    templates?: string[];
    // Libellé et styles propres à un modèle de mémento (ex. "pj")
    variants?: Record<string, Partial<Pick<Field, 'label' | 'style'>>>;
}

export interface OverlayFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface OverlayPlacement {
    offsetX: number;
    offsetY: number;
    scale: number;
}

export interface OverlayImageState extends OverlayPlacement {
    image: HTMLImageElement;
    isLoaded: boolean;
}

export interface PlayerLabelOption {
    key: string;
    label?: string;
}

export interface Separator {
    x: number;
    y: number;
    width: number;
    color: string;
}

export interface FoldLayout {
    // Écart en pixels par rapport à la largeur du pli dessinée dans le fond
    offset: number;
    // Bandes unies du fond, étirées chacune de la moitié de l'écart
    stretchZones: [number, number][];
}

export interface CanvasRendererProps {
    fields: Field[];
    playerLabel: string;
    playerLabelStyle: TextStyle;
    overlayImage: OverlayImageState;
    overlayFrame: OverlayFrame;
    overlayScaleRange: [number, number];
    onOverlayChange?: (placement: Partial<OverlayPlacement>) => void;
    fold: FoldLayout;
    separators: Separator[];
    onCanvasReady?: (canvasRef: React.RefObject<HTMLCanvasElement>) => void;
    onTextOverflow?: (overflow: boolean) => void;
    width: number;
    height: number;
}
