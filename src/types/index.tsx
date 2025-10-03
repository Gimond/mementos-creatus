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
}

export interface Field {
    id: number;
    label: string;
    value: string;
    type: string;
    fieldSize?: string;
    style: TextStyle[];
}

export interface OverlayImageState {
    x: number;
    y: number;
    width: number;
    height: number;
    image: HTMLImageElement;
    isLoaded: boolean;
}

export interface CanvasRendererProps {
    fields: Field[];
    overlayImage: OverlayImageState;
    onCanvasReady?: (canvasRef: React.RefObject<HTMLCanvasElement>) => void;
    width?: number;
    height?: number;
}