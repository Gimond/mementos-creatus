import {useRef, useState} from 'react';
import Editor, {BtnBold, BtnItalic, Toolbar} from 'react-simple-wysiwyg';
import {Modal} from "./Modal.tsx";
import StatBlock from "./StatBlock.tsx";
import CanvasRenderer from "./CanvasRenderer.tsx";
import './App.css';
import logoImage from './assets/logo.png';
import configData from './config.json';
import type { Field, OverlayImageState } from './types';
import {BsPlusCircle, BsBoxArrowInRight, BsImage} from 'react-icons/bs';

// Get vars from config.json
const CANVAS_WIDTH = configData.canvasSettings.width;
const CANVAS_HEIGHT = configData.canvasSettings.height;
const MAX_OVERLAY_WIDTH = configData.overlayImageSettings.maxWidth;
const MAX_OVERLAY_HEIGHT = configData.overlayImageSettings.maxHeight;
const FIELDS = configData.fields as unknown as Field[];

// Hook personnalisé pour la gestion des images
function useOverlayImage() {
    const [overlayImage, setOverlayImage] = useState<OverlayImageState>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
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
            width: 0,
            height: 0,
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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const statBlockRef = useRef<any>(null);
    const [fields, setFields] = useState<Field[]>(FIELDS);
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
        // const canvas = document.querySelector('canvas');
        const canvas = canvasRef.current;
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
                updatedField.value = attributes.attaques.join('<br/>---<br/>');
            }

            return updatedField;
        });

        setFields(updatedFields);
        setModalOpen(false);
    };

    const handleCanvasReady = (canvasRefFromChild: React.RefObject<HTMLCanvasElement>) => {
        if (canvasRefFromChild && canvasRefFromChild.current) {
            canvasRef.current = canvasRefFromChild.current;
        }
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
                        <button className="btn btn-secondary reset-all-btn" onClick={handleReset}>
                            <BsPlusCircle />
                            Nouveau
                        </button>
                        <button className="btn import-btn" onClick={handleImportStatblock}>
                            <BsBoxArrowInRight />
                            Importer statblock
                        </button>
                        <button className="btn btn-big download-btn" onClick={handleDownload}>
                            <BsImage />
                            Telecharger l'image
                        </button>
                    </div>
                </div>

                <div className="image-panel">
                    <CanvasRenderer
                        ref={canvasRef}
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
                content={<div>Copiez et collez un bloc de statistiques provenant d'un PDF. Vous pouvez sélectionnez le texte du nom de la créatures jusqu'aux attaques (comprises), Les différentes descriptions suivantes ne seront pas reconnues et risquent de perturber la détection des attaques mais vous pourrez les copier ensuite dans le bloc Texte.<br /><StatBlock ref={statBlockRef}/></div>}
            />
        </div>
    );
}

export default App;