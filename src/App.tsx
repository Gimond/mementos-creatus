import {useRef, useState} from 'react';
import Editor, {BtnBold, BtnItalic, Toolbar} from 'react-simple-wysiwyg';
import {Modal} from "./Modal.tsx";
import StatBlock from "./StatBlock.tsx";
import CanvasRenderer from "./CanvasRenderer.tsx";
import './App.css';
import logoImage from './assets/logo.png';
import configData from './config.json';

// Types extraits pour améliorer la lisibilité et la réutilisabilité
type StyleConfig = {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    prefix?: string;
    textAlign?: string;
    rotate?: number;
    wrapText?: boolean;
};

type Field = {
    id: number;
    type: 'text' | 'editor';
    label: string;
    value: string;
    fieldSize?: string;
    style: StyleConfig[];
};

type OverlayImageState = {
    x: number;
    y: number;
    width: number;
    height: number;
    image: HTMLImageElement;
    isLoaded: boolean;
};

// Constants extraites
// Extraire les constantes de la configuration
const CANVAS_WIDTH = configData.canvasSettings.width;
const CANVAS_HEIGHT = configData.canvasSettings.height;
const MAX_OVERLAY_WIDTH = configData.overlayImageSettings.maxWidth;
const MAX_OVERLAY_HEIGHT = configData.overlayImageSettings.maxHeight;

// Convertir les champs de la configuration en champs utilisables par l'application
const DEFAULT_FIELDS: Field[] = configData.fields.map(field => ({
    ...field,
    value: field.defaultValue // Remplacer defaultValue par value
}));


// Hook personnalisé pour la gestion des images
function useOverlayImage() {
    const [overlayImage, setOverlayImage] = useState<OverlayImageState>({
        x: 0,
        y: 0,
        width: 535,
        height: 390,
        image: new Image(),
        isLoaded: false
    });

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const newImg = new Image();
            newImg.src = event.target?.result as string;
            newImg.onload = () => {
                // Calcul des dimensions proportionnelles
                let newWidth = newImg.width;
                let newHeight = newImg.height;

                // Ajuster la largeur si nécessaire
                if (newImg.width > MAX_OVERLAY_WIDTH) {
                    newWidth = MAX_OVERLAY_WIDTH;
                    newHeight = (newImg.height * MAX_OVERLAY_WIDTH) / newImg.width;
                }

                // Ajuster la hauteur si nécessaire
                if (newHeight > MAX_OVERLAY_HEIGHT) {
                    newHeight = MAX_OVERLAY_HEIGHT;
                    newWidth = (newImg.width * MAX_OVERLAY_HEIGHT) / newImg.height;
                }

                setOverlayImage({
                    ...overlayImage,
                    width: newWidth,
                    height: newHeight,
                    image: newImg,
                    isLoaded: true
                });
            };
        };
        reader.readAsDataURL(file);
    };

    const resetImage = () => {
        setOverlayImage({
            x: 0,
            y: 0,
            width: 150,
            height: 150,
            image: new Image(),
            isLoaded: false
        });

        const fileInput = document.getElementById('overlay-image') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    };

    return {overlayImage, handleImageChange, resetImage};
}

// Composant extrait pour le rendu d'un champ
function FieldInput({field, onChange}: { field: Field, onChange: (id: number, value: string) => void }) {
    if (field.type === 'editor') {
        return (
            <Editor value={field.value} onChange={(e) => onChange(field.id, e.target.value)}>
                <Toolbar>
                    <BtnBold/>
                    <BtnItalic/>
                </Toolbar>
            </Editor>
        );
    }

    return (
        <input
            type="text"
            id={`text-${field.id}`}
            value={field.value}
            onChange={(e) => onChange(field.id, e.target.value)}
        />
    );
}

function App() {
    useRef<HTMLCanvasElement>(null);
    const statBlockRef = useRef<any>(null);
    const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS);
    const [modalOpen, setModalOpen] = useState(false);
    const {overlayImage, handleImageChange, resetImage} = useOverlayImage();

    // Gestionnaires d'événements pour les champs
    const handleTextChange = (id: number, value: string) => {
        setFields(fields.map(item =>
            item.id === id ? {...item, value} : item
        ));
    };

    // Gestionnaires d'événements pour les actions principales
    const handleReset = () => {
        if (window.confirm('Cette action va vider tous les champs, êtes-vous sûr ?')) {
            setFields(fields.map(field => ({...field, value: ''})));
            resetImage();
        }
    };

    const handleDownload = () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        const imageURL = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = imageURL;

        const nameField = fields.find(f => f.label === 'Nom');
        downloadLink.download = nameField?.value ? `${nameField.value}.png` : 'memento.png';

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    // Gestionnaires d'événements pour l'importation des statblocks
    const handleImportStatblock = () => {
        setModalOpen(true);
    };

    const handleImportAttributes = () => {
        if (!statBlockRef.current?.attributes) return;

        const attributes = statBlockRef.current.attributes;
        const updatedFields = fields.map(field => {
            let updatedField = {...field};

            if (attributes[field.label]) {
                updatedField.value = attributes[field.label];
            }

            if (field.label === 'Texte' && attributes.attaques) {
                updatedField.value = attributes.attaques.join('\n');
            }

            return updatedField;
        });

        setFields(updatedFields);
        setModalOpen(false);
    };

    const handleCanvasReady = () => {
        // Fonction gardée pour compatibilité
    };

    return (
        <div className="app-container">
            <div className="banner">
                <img src={logoImage} alt="Chroniques Oubliées Fantasy" className="logo"/>
                <h1>Memento Creatus</h1>
            </div>

            <div className="content">
                <div className="params-panel">
                    <div className="fields">
                        {fields.map((field) => (
                            <div key={`param-group-${field.id}`}
                                 className={`param-group width-${field.fieldSize ?? '100'}`}>
                                <label htmlFor={`text-${field.id}`}>{field.label}</label>
                                <FieldInput field={field} onChange={handleTextChange}/>
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

                <div className="image-panel">
                    <CanvasRenderer
                        fields={fields}
                        overlayImage={overlayImage}
                        onCanvasReady={handleCanvasReady}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                    />
                </div>
            </div>

            <Modal
                open={modalOpen}
                titleContent={<h3>Importer un bloc de statistiques</h3>}
                primaryFn={handleImportAttributes}
                secondaryFn={() => setModalOpen(false)}
                cancelFn={() => setModalOpen(false)}
                content={<StatBlock ref={statBlockRef}/>}
            />
        </div>
    );
}

export default App;