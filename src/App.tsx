import { useState, useEffect, useRef } from 'react'
import Editor, {
    BtnBold,
    BtnItalic,
    Toolbar
} from 'react-simple-wysiwyg';
// import { BsDownload, BsFileEarmarkPlus, BsPlusCircle, BsBoxArrowInRight, BsImage } from "react-icons/bs";
import {Modal} from "./Modal.tsx";
import StatBlock from "./StatBlock.tsx";
import 'fontfaceobserver';

import './App.css'
import logoImage from './assets/logo.png';

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const statBlockRef = useRef<any>(null);

    const [fontsLoaded, setFontsLoaded] = useState(false);

    interface TextStyle {
        x: number;
        y: number;
        fontSize: number;
        color: string;
        fontFamily: string;
        textAlign?: CanvasTextAlign | undefined;
        rotate?: number;
        prefix?: string;
        editor?: boolean;
        wrapText?: boolean;
    }

    interface Field {
        id: number;
        label: string;
        value: string;
        type: string;
        fieldSize?: string;
        style: TextStyle[];
    }

    const [fields, setFields] = useState<Field[]>([
        { id: 1, type: 'text', label: 'Nom', value: 'Squelette', style: [
                { x: 210 , y: 592, fontSize: 26, color: '#b48333', fontFamily: 'Rodfat', textAlign: 'center' },
                { x: 267 , y: 425, fontSize: 26, color: '#b48333', fontFamily: 'Rodfat', rotate: 180, textAlign: 'center' }
            ]},
        { id: 2, type: 'text', label: 'Type', fieldSize: '75', value: 'Mort-vivant', style: [
                { x: 210, y: 530, fontSize: 22, color: '#b48333', fontFamily: 'Rodfat', prefix: 'Créature ', textAlign: 'center' }
            ]},
        { id: 3, type: 'text', label: 'NC', fieldSize: '25', value: '2', style: [
                { x: 454, y: 592, fontSize: 24, color: '#b48333', fontFamily: 'Rodfat', prefix: 'NC ', textAlign: 'center' }
            ]},
        { id: 4, type: 'text', label: 'Taille', value: 'Petit', style: [
                { x: 36, y: 676, fontSize: 20, color: '#424242', fontFamily: 'Ikarius', prefix: 'Taille : ' }
            ]},

        { id: 5, type: 'text', label: 'AGI', fieldSize: '25', value: '0', style: [
                { x: 79, y: 718, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},
        { id: 6, type: 'text', label: 'CON', fieldSize: '25', value: '+1', style: [
                { x: 203, y: 718, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},
        { id: 7, type: 'text', label: 'FOR', fieldSize: '25', value: '+2', style: [
                { x: 313, y: 718, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},
        { id: 8, type: 'text', label: 'PER', fieldSize: '25', value: '-1', style: [
                { x: 423, y: 718, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},
        { id: 9, type: 'text', label: 'CHA', fieldSize: '25', value: '-2', style: [
                { x: 89, y: 746, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},
        { id: 10, type: 'text', label: 'INT', fieldSize: '25', value: '+4', style: [
                { x: 192, y: 746, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},
        { id: 11, type: 'text', label: 'VOL', fieldSize: '25', value: '-4', style: [
                { x: 312, y: 746, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},

        { id: 12, type: 'text', label: 'DEF', fieldSize: '33', value: '15 (RD2)', style: [
                { x: 119, y: 794, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},
        { id: 13, type: 'text', label: 'PV', fieldSize: '33', value: '90', style: [
                { x: 297, y: 794, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' }
            ]},
        { id: 14, type: 'text', label: 'Init', fieldSize: '33', value: '12', style: [
                { x: 459, y: 794, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
                { x: 452 , y: 530, fontSize: 22, color: '#FFFFFF', fontFamily: 'Rodfat', prefix: 'Init.', textAlign: 'center' }
            ]},
        { id: 15, type: 'editor', label: 'Texte', value: '<b>Lorem ipsum dolor sit amet</b>, consectetur adipiscing elit.', style: [
                { x: 36, y: 835, fontSize: 18, color: '#424242', fontFamily: 'Ikarius', wrapText: true }
            ]},
    ]);

    const [modalOpen, setModalOpen] = useState(false);

    const [overlayImage, setOverlayImage] = useState({
        x: 0,
        y: 0,
        width: 535,
        height: 390,
        image: new Image(),
        isLoaded: false
    });

    // État pour gérer le chargement de l'image de fond
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
            isLineBreak?: boolean; // Nouveau: indique si c'est un saut de ligne <br>
        };

        // Fonction pour parser et dessiner le texte HTML
        const parseAndDrawHtml = (html: string) => {
            html = html.replace(/\n/g, '<br/>');
            html = html.replace(/<br>/g, '<br/>');
            // remove first opening div
            html = html.replace(/^<div>/g, '');
            // replace divs with only a br with a br
            html = html.replace(/<div>[\s\n]*<br\/>[\s\n]*<\/div>/g, '<br/>');
            // replace opening divs with a br
            html = html.replace(/<div>/g, '<br/>');
            // clean up
            html = html.replace(/<\/div>/g, '');
            html = html.replace(/<div>/g, '');

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
                        // C'est un autre type d'élément, on le traite récursivement
                        Array.from(element.childNodes).forEach(parseNode);
                    }
                }
            };

            Array.from(tempDiv.childNodes).forEach(parseNode);

            // Dessiner le texte formaté avec retour à la ligne
            let currentX = x;
            let line: { text: string, bold: boolean }[] = [];

            for (const segment of textNodes) {
                // Si c'est un saut de ligne <br>, on traite la ligne actuelle et on passe à la ligne suivante
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

                    // Configurer le style pour mesurer ce mot
                    ctx.font = segment.bold
                        ? `bold ${fontSize}px ${fontFamily}`
                        : `${fontSize}px ${fontFamily}`;

                    const wordWidth = ctx.measureText(wordWithSpace).width;

                    // Si le mot dépasse la largeur maximale
                    if (currentX + wordWidth > x + maxWidth) {
                        // Dessiner la ligne courante
                        drawLine(line, x, currentY);

                        // Passer à la ligne suivante
                        currentY += lineHeight;
                        line = [];
                        currentX = x;

                        // Ajouter le mot à la nouvelle ligne
                        line.push({ text: wordWithSpace, bold: segment.bold });
                        currentX += wordWidth;
                    } else {
                        // Ajouter le mot à la ligne courante
                        line.push({ text: wordWithSpace, bold: segment.bold });
                        currentX += wordWidth;
                    }
                }
            }

            // Dessiner la dernière ligne si nécessaire
            if (line.length > 0) {
                drawLine(line, x, currentY);
                currentY += lineHeight;
            }
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
                // Appliquer le style au contexte
                ctx.font = segment.bold
                    ? `bold ${fontSize}px ${fontFamily}`
                    : `${fontSize}px ${fontFamily}`;

                // Dessiner le segment
                ctx.fillText(segment.text, posX, lineY);

                // Mettre à jour la position X
                posX += ctx.measureText(segment.text).width;
            }
        };

        // Parser et dessiner le contenu HTML
        parseAndDrawHtml(htmlContent);

        // Retourner la position Y finale
        return currentY;
    };

    const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);

    // Chargement initial de l'image de fond
    useEffect(() => {
        const img = new Image();
        img.src = '/background.png';
        img.onload = () => {
            setBackgroundImage(img);
        };

        // Créer des observateurs pour chaque police
        const rodfatFont = new FontFaceObserver('Rodfat');
        const ikariusFont = new FontFaceObserver('Ikarius');

        // Attendre que les polices soient chargées
        Promise.all([
            rodfatFont.load(null, 5000),  // Timeout de 5 secondes
            ikariusFont.load(null, 5000)
        ])
        .then(() => {
            console.log('Polices chargées !');
            setFontsLoaded(true);
        })
        .catch(err => {
            console.error('Erreur lors du chargement des polices:', err);
            setFontsLoaded(true);
        });

    }, []);

    // Largeur et hauteur fixes de l'image de fond/zone d'affichage
    const canvasWidth = 535;
    const canvasHeight = 1609;

    // Fonction pour mettre à jour un champ texte
    const handleTextChange = (id: number, value: string) => {
        setFields(fields.map(item =>
            item.id === id ? { ...item, value: value } : item
        ));
    };

    // Fonction pour gérer le changement d'image
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newImg = new Image();
                newImg.src = event.target?.result as string;
                newImg.onload = () => {
                    let maxw = 535;
                    let maxh = 390;
                    if (newImg.width > maxw) {
                        overlayImage.width = maxw;
                        overlayImage.height = (newImg.height * maxw) / newImg.width;
                    }
                    if (newImg.height > maxh) {
                        overlayImage.height = maxh;
                        overlayImage.width = (newImg.width * maxh) / newImg.height;
                    }
                    setOverlayImage({
                        ...overlayImage,
                        image: newImg,
                        isLoaded: true
                    });
                };
            };
            reader.readAsDataURL(file);
        }
    };

    function drawRotatedImage(
        ctx: CanvasRenderingContext2D,
        image: HTMLImageElement,
        x: number,
        y: number,
        width: number,
        height: number,
        angle: number
    ) {
        let containerWidth = 535;
        let containerHeight = 390;

        // Calcul du ratio d'aspect de l'image
        const imageAspectRatio = image.width / image.height;

        // Calcul du ratio d'aspect du conteneur
        const containerAspectRatio = containerWidth / containerHeight;

        // Dimensions pour maintenir l'aspect ratio de l'image à l'intérieur du conteneur
        let drawWidth, drawHeight;

        if (imageAspectRatio > containerAspectRatio) {
            // L'image est plus large que le conteneur (par rapport au ratio)
            drawWidth = containerWidth;
            drawHeight = containerWidth / imageAspectRatio;
        } else {
            // L'image est plus haute que le conteneur (par rapport au ratio)
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

        // Calculer les coordonnées pour centrer l'image dans le conteneur
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;

        // Sauvegarder l'état du contexte
        ctx.save();

        // Déplacer le point d'origine au centre du conteneur
        ctx.translate(centerX, centerY);
        ctx.translate(x, y);

        // Appliquer la rotation (en radians)
        ctx.rotate(angle * Math.PI / 180);

        // Dessiner l'image centrée
        ctx.drawImage(
            image,
            -drawWidth / 2,  // Position X par rapport au point d'origine (centre)
            -drawHeight / 2, // Position Y par rapport au point d'origine (centre)
            drawWidth,
            drawHeight
        );

        // Restaurer l'état du contexte
        ctx.restore();

    }

    function drawRotatedText(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        rotate: number,
        fontSize: number,
        textAlign: CanvasTextAlign | undefined,
        fontFamily: string,
        color: string

    ): void {
        if (fontFamily == 'Rodfat') {
            text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents for Rodfat font (not supported)
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
    }

    const handleReset = () => {
        // Confirmation avant réinitialisation
        if (window.confirm('Cette action va vider tous les champs, êtes-vous sûr ?')) {
            fields.forEach(field => {
                field.value = '';
            });

            // Supprimer l'image
            setOverlayImage({
                x: 0,
                y: 0,
                width: 150,
                height: 150,
                image: new Image(),
                isLoaded: false
            });

            // Réinitialiser également l'input de fichier s'il existe
            const fileInput = document.getElementById('overlay-image') as HTMLInputElement;
            if (fileInput) {
                fileInput.value = '';
            }
        }
    };

    // Fonction pour dessiner le canvas
    const drawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (!fontsLoaded) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Effacer le canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Dessiner l'image de fond
        if (backgroundImage) {
            ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
        }

        // Dessiner l'image superposée
        if (overlayImage.isLoaded) {
            drawRotatedImage(ctx, overlayImage.image, overlayImage.x, overlayImage.y, overlayImage.width, overlayImage.height, 180);
        }

        // Dessiner les textes
        if (fontsLoaded) {
            fields.forEach(field => {
                field.style.forEach(style => {
                    if (field.type == 'editor') {
                        drawHtmlText(ctx, field.value, style.x, style.y, 470, 1.3 * style.fontSize, style.fontSize, style.fontFamily, style.color);
                    } else {
                        drawRotatedText(ctx, (style.prefix ?? '') + field.value, style.x, style.y, style.rotate ?? 0, style.fontSize, style.textAlign, style.fontFamily, style.color);
                    }
                });
            });
        }
    };

    // Dessiner le canvas quand les paramètres changent
    useEffect(() => {
        drawCanvas();
    }, [fields, overlayImage, backgroundImage, fontsLoaded]);

    // Fonction pour télécharger le canvas comme image
    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const imageURL = canvas.toDataURL('image/png');

        const downloadLink = document.createElement('a');
        downloadLink.href = imageURL;
        // get name
        const name = fields.find(f => f.label === 'Nom')?.value ?? 'memento';
        downloadLink.download = name + '.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    // Fonction qui gère l'importation des attributs
    const handleImportAttributes = () => {
        if (statBlockRef.current) {
            const attributes = statBlockRef.current.attributes;

            if (attributes) {
                fields.forEach(field => {
                    if (attributes[field.label]) {
                        field.value = attributes[field.label];
                    }
                    if (field.label == 'Texte' && attributes.attaques) {
                        field.value = '';
                        attributes.attaques.forEach((a: string) => {
                            field.value += a + '\n';
                        });
                    }
                });
                setFields(fields);
            }

            setModalOpen(false);
            drawCanvas();
        }
    };

    const handleImportStatblock = () => {
        setModalOpen(true);
    };

    return (
        <div className="app-container">
            <div className="banner">
                <img src={logoImage} alt="Chroniques Oubliées Fantasy" className="logo" />
                <h1>Memento Creatus</h1>
            </div>

            {/* Zone de paramètres (côté gauche) */}
            <div className="content">
                <div className="params-panel">
                    <div className="fields">
                        {fields.map((field) => (
                            <div key={`param-group-${field.id}`} className={`param-group width-${field.fieldSize??'100'}`}>
                                <label htmlFor={`text-${field.id}`}>{field.label}</label>

                                {field.type === 'editor' ?
                                    <Editor value={field.value} onChange={(e) => handleTextChange(field.id, e.target.value)}>
                                        <Toolbar>
                                            <BtnBold />
                                            <BtnItalic />
                                        </Toolbar>
                                    </Editor>
                                    :
                                    <input
                                        type="text"
                                        id={`text-${field.id}`}
                                        value={field.value}
                                        onChange={(e) => handleTextChange(field.id, e.target.value)}
                                    />
                                }
                            </div>
                        ))}

                        <div className="param-group width-100">
                            <label htmlFor='overlay-image'>Illustration</label>
                            <input
                                type="file"
                                id="overlay-image"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                        </div>
                    </div>

                    <div className="buttons">
                        <button className="btn reset-all-btn" onClick={handleReset}>
                            Nouveau
                        </button>
                        <button className="btn import-btn" onClick={handleImportStatblock}>
                            Importer statblock
                        </button>
                        <button className="btn download-btn" onClick={handleDownload}>
                            Télécharger l'image
                        </button>
                    </div>
                </div>

                {/* Zone d'affichage de l'image (côté droit) */}
                <div className="image-panel">
                    <canvas
                        ref={canvasRef}
                        width={canvasWidth}
                        height={canvasHeight}
                        className="image-canvas"
                    />
                </div>
            </div>

            <Modal
                open={modalOpen}
                titleContent={<h3>Importer un bloc de statistiques</h3>}
                primaryFn={handleImportAttributes}
                secondaryFn={() => setModalOpen(false)}
                cancelFn={() => setModalOpen(false)}
                content={
                    <>
                        <StatBlock ref={statBlockRef} />
                    </>

                }
            />
        </div>
    );
}

export default App