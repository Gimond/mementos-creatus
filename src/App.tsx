import { useState, useEffect, useRef } from 'react'
import Editor, {
    BtnBold,
    BtnItalic,
    Toolbar
} from 'react-simple-wysiwyg';
import StatBlock from "./StatBlock.tsx";
import {Modal} from "./Modal.tsx";
import './App.css'
import logoImage from './assets/logo.png';

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const statBlockRef = useRef<any>(null);

    const [fontsLoaded, setFontsLoaded] = useState(false);

    // État pour stocker les paramètres
    const [textFields, setTextFields] = useState([
        { id: 1, label: 'Nom', text: 'Squelette', style: [
            { x: 210 , y: 592, fontSize: 26, color: '#b48333', fontFamily: 'Rodfat', textAlign: 'center' },
            { x: 267 , y: 425, fontSize: 26, color: '#b48333', fontFamily: 'Rodfat', rotate: 180, textAlign: 'center' }
        ]},
        { id: 2, label: 'Type', fieldSize: '75', text: 'Mort-vivant', x: 210, y: 530, fontSize: 22, color: '#b48333', fontFamily: 'Rodfat', prefix: 'Créature ', textAlign: 'center' },
        { id: 3, label: 'NC', fieldSize: '25', text: '2', x: 454, y: 592, fontSize: 24, color: '#b48333', fontFamily: 'Rodfat', prefix: 'NC ', textAlign: 'center' },
        { id: 4, label: 'Taille', text: 'Petit', x: 36, y: 676, fontSize: 20, color: '#424242', fontFamily: 'Ikarius', prefix: 'Taille : ' },

        { id: 5, label: 'AGI', fieldSize: '25', text: '0', x: 79, y: 718, fontSize: 20, color: '#424242', fontFamily: 'Ikarius'},
        { id: 6, label: 'CON', fieldSize: '25', text: '+1', x: 203, y: 718, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
        { id: 7, label: 'FOR', fieldSize: '25', text: '+2', x: 313, y: 718, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
        { id: 8, label: 'PER', fieldSize: '25', text: '-1', x: 423, y: 718, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
        { id: 9, label: 'CHA', fieldSize: '25', text: '-2', x: 89, y: 746, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
        { id: 10, label: 'INT', fieldSize: '25', text: '+4', x: 192, y: 746, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
        { id: 11, label: 'VOL', fieldSize: '25', text: '-4', x: 312, y: 746, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },

        { id: 12, label: 'DEF', fieldSize: '33', text: '15 (RD2)', x: 119, y: 794, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
        { id: 13, label: 'PV', fieldSize: '33', text: '90', x: 297, y: 794, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
        { id: 14, label: 'Init', fieldSize: '33', text: '12', style: [
            { x: 459, y: 794, fontSize: 20, color: '#424242', fontFamily: 'Ikarius' },
            { x: 452 , y: 530, fontSize: 22, color: '#FFFFFF', fontFamily: 'Rodfat', prefix: 'Init.', textAlign: 'center' }
        ]},
        { id: 15, label: 'Texte', text: '<b>Lorem ipsum dolor sit amet</b>, consectetur adipiscing elit. In eget dignissim mi, eu hendrerit ante. Duis vel sapien sed felis tempor scelerisque et vel elit. Aenean tempor massa vel mauris consectetur congue. Ut feugiat neque vel lorem euismod iaculis id non justo.', x: 36, y: 835, fontSize: 18, color: '#424242', fontFamily: 'Ikarius', editor: true, wrapText: true },
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
    const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);

    const drawHtmlText = (
        ctx: CanvasRenderingContext2D,
        htmlContent: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        fontFamily: string,
        fontSize: number,
        color: string
    ): number => {
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

    // Chargement des polices web
    useEffect(() => {
        // Utiliser la Font Loading API pour s'assurer que les polices sont chargées
        const fontPromises = ['Rodfat', 'Ikarius']
            .map(font => {
                // Créer une promesse pour chaque police
                return new Promise<void>((resolve) => {
                    // Vérifier si la police est déjà disponible
                    console.log(document.fonts);
                    if (document.fonts && document.fonts.check(`12px ${font.value}`)) {
                        resolve();
                        return;
                    }

                    // Sinon, charger la police et attendre qu'elle soit prête
                    if (document.fonts && document.fonts.load) {
                        document.fonts.load(`12px ${font.value}`).then(() => {
                            resolve();
                        }).catch(() => {
                            // En cas d'erreur, on résout quand même pour ne pas bloquer l'application
                            console.warn(`Failed to load font: ${font.value}`);
                            resolve();
                        });
                    } else {
                        // Fallback si l'API Font Loading n'est pas disponible
                        setTimeout(resolve, 1500);
                    }
                });
            });

        // Attendre que toutes les polices soient chargées
        Promise.all(fontPromises).then(() => {
            setFontsLoaded(true);
            drawCanvas();
        });
    }, []);

    // Chargement initial de l'image de fond
    useEffect(() => {
        const img = new Image();
        img.src = '/background.png';
        img.onload = () => {
            setBackgroundImage(img);
        };
    }, []);

    // Largeur et hauteur fixes de l'image de fond/zone d'affichage
    const canvasWidth = 535;
    const canvasHeight = 1609;

    // Fonction pour mettre à jour un champ texte
    const handleTextChange = (id: number, field: string, value: string | number) => {
        setTextFields(textFields.map(item =>
            item.id === id ? { ...item, [field]: value } : item
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

    function drawRotatedImage(ctx, image, x, y, width, height, angle, scrollX, scrollY) {
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

        // Calculer les coordonnées pour centrer l'image dans le conteneur
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;

        // Sauvegarder l'état du contexte
        ctx.save();

        // Déplacer le point d'origine au centre du conteneur
        ctx.translate(centerX, centerY);

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

    function drawRotatedText(ctx, text, x, y, angle, fontSize, textAlign, fontFamily, color) {
        if (fontFamily == 'Rodfat') {
            text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents for Rodfat font (not supported)
        }

        ctx.textAlign = textAlign ?? 'left';
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;

        ctx.save();
        ctx.translate(x, y);
        if (angle !== 0) {
            if (ctx.textAlign === 'center') {
                ctx.translate(0, fontSize / 2 * -1);
            } else if (ctx.textAlign === 'left') {
                ctx.translate(ctx.measureText(text).width, fontSize / 2 * -1);
            } else if (ctx.textAlign === 'right') {
                ctx.translate(-ctx.measureText(text).width, fontSize / 2 * -1);
            } else {
                ctx.translate(0, fontSize / 2 * -1);
            }
            ctx.rotate(Math.PI / 180 * angle);
        }
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    const handleReset = () => {
        // Confirmation avant réinitialisation
        if (window.confirm('Cette action va vider tous les champs, êtes-vous sûr ?')) {
            textFields.forEach(field => {
                field.text = '';
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
            drawRotatedImage(ctx, overlayImage.image, overlayImage.x, overlayImage.y, overlayImage.width, overlayImage.height, 180, 0, 0);
        }

        // Dessiner les textes
        if (fontsLoaded) {
            textFields.forEach(field => {
                if (field.label == 'Texte') {
                    ctx.textAlign = field.textAlign ?? 'left';
                    ctx.font = `${field.fontSize}px ${field.fontFamily}`;
                    ctx.fillStyle = field.color;
                    drawHtmlText(ctx, field.text, field.x, field.y, 470, 1.3 * field.fontSize, field.fontFamily, field.fontSize, field.color);
                } else {
                    if (field.style) {
                        field.style.forEach(f => {
                            drawRotatedText(ctx, (f.prefix ?? '') + field.text, f.x, f.y, f.rotate ?? 0, f.fontSize, f.textAlign, f.fontFamily, f.color);
                        });
                    } else {
                        drawRotatedText(ctx, (field.prefix ?? '') + field.text, field.x, field.y, field.rotate ?? 0, field.fontSize, field.textAlign, field.fontFamily, field.color);
                    }
                }
            });
        }
    };

    // Dessiner le canvas quand les paramètres changent
    useEffect(() => {
        drawCanvas();
    }, [textFields, overlayImage, backgroundImage]);

    // Fonction pour télécharger le canvas comme image
    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const imageURL = canvas.toDataURL('image/png');

        const downloadLink = document.createElement('a');
        downloadLink.href = imageURL;
        // get name
        const name = textFields.find(f => f.label === 'Nom')?.text ?? 'memento';
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
                textFields.forEach(field => {
                    if (attributes[field.label]) {
                        field.text = attributes[field.label];
                    }
                    if (field.label == 'Texte' && attributes.attaques) {
                        field.text = '';
                        attributes.attaques.forEach(a => {
                            field.text += a + '\n';
                        })
                    }
                });
                setTextFields(textFields);
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
                        {textFields.map((field) => (
                            <div className={`param-group width-${field.fieldSize??'100'}`}>
                                <label htmlFor={`text-${field.id}`}>{field.label}</label>

                                {field.editor ?
                                    <Editor value={field.text} onChange={(e) => handleTextChange(field.id, 'text', e.target.value)}>
                                        <Toolbar>
                                            <BtnBold />
                                            <BtnItalic />
                                        </Toolbar>
                                    </Editor>
                                    :
                                    <input
                                        type="text"
                                        id={`text-${field.id}`}
                                        value={field.text}
                                        onChange={(e) => handleTextChange(field.id, 'text', e.target.value)}
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
                        <button
                            type="button"
                            className="reset-all-btn"
                            onClick={handleReset}
                        >
                            Nouveau
                        </button>
                        <button className="import-btn" onClick={handleImportStatblock}>
                            Importer statblock
                        </button>
                        <button className="download-btn" onClick={handleDownload}>
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