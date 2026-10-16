import {useMemo, useRef, useState} from 'react';
import Editor, {BtnBold, BtnItalic, Toolbar} from 'react-simple-wysiwyg';
import {Modal} from "./Modal.tsx";
import StatBlock, {type StatBlockHandle} from "./StatBlock.tsx";
import CanvasRenderer from "./CanvasRenderer.tsx";
import './App.css';
import logoImage from './assets/logo.png';
import configData from './config.json';
import {withoutAccents} from './text';
import type { Field, FoldLayout, OverlayFrame, OverlayImageState, OverlayPlacement, PlayerLabelOption, Separator, TextStyle } from './types';
import {BsPlusCircle, BsBoxArrowInRight, BsImage, BsInfoCircle} from 'react-icons/bs';

// Get vars from config.json
const CANVAS_WIDTH = configData.canvasSettings.width;
const CANVAS_HEIGHT = configData.canvasSettings.height;
const OVERLAY_FRAME: OverlayFrame = configData.overlayImageSettings;
const OVERLAY_SCALE_RANGE: [number, number] = [configData.overlayImageSettings.minScale, configData.overlayImageSettings.maxScale];
const FIELDS = configData.fields as unknown as Field[];
const PLAYER_LABEL_OPTIONS: PlayerLabelOption[] = configData.playerLabelSettings.options;
const PLAYER_LABEL_STYLE = configData.playerLabelSettings.style as TextStyle;
const TEMPLATE_OPTIONS: { key: string, label: string, separators?: Separator[] }[] = configData.templateSettings.options;
const NO_SEPARATORS: Separator[] = [];
const FIELD_GROUPS = configData.fieldGroups;
const FOLD = configData.foldSettings;
const BACKGROUNDS = configData.backgroundSettings.options;
// Résolution supposée à l'impression, pour afficher la largeur du pli en millimètres
const PRINT_DPI = 300;

// Réglage mémorisé dans le navigateur : il dépend du matériel du MJ (écran, imprimante), pas de la créature
function useStoredChoice<T extends string | number>(storageKey: string, choices: T[], fallback: T) {
    const [value, setValue] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            return choices.find(choice => String(choice) === stored) ?? fallback;
        } catch {
            return fallback;
        }
    });

    const updateValue = (newValue: T) => {
        setValue(newValue);
        try {
            localStorage.setItem(storageKey, String(newValue));
        } catch {
            // Stockage indisponible (navigation privée) : le réglage ne sera pas mémorisé
        }
    };

    return [value, updateValue] as const;
}

const applyTemplate = (field: Field, template: string): Field => ({...field, ...field.variants?.[template]});

const EMPTY_OVERLAY: OverlayImageState = {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    image: new Image(),
    isLoaded: false
};

// Hook personnalisé pour la gestion des images
function useOverlayImage() {
    const [overlayImage, setOverlayImage] = useState<OverlayImageState>(EMPTY_OVERLAY);

    const loadImageFile = (file: File) => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const newImg = new Image();
            newImg.src = event.target?.result as string;
            newImg.onload = () => {
                // L'image est ajustée au cadre lors du rendu, on repart d'un placement centré
                setOverlayImage({...EMPTY_OVERLAY, image: newImg, isLoaded: true});
            };
        };
        reader.readAsDataURL(file);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) loadImageFile(file);
    };

    const updatePlacement = (placement: Partial<OverlayPlacement>) => {
        setOverlayImage(current => ({...current, ...placement}));
    };

    const resetPlacement = () => {
        updatePlacement({offsetX: 0, offsetY: 0, scale: 1});
    };

    const resetImage = () => {
        setOverlayImage(EMPTY_OVERLAY);

        const fileInput = document.getElementById('overlay-image') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    };

    return {overlayImage, loadImageFile, handleImageChange, updatePlacement, resetPlacement, resetImage};
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
    const statBlockRef = useRef<StatBlockHandle>(null);
    const [fields, setFields] = useState<Field[]>(FIELDS);
    const [modalOpen, setModalOpen] = useState(false);
    const [infoModalOpen, setInfoModalOpen] = useState(false);
    const [textOverflow, setTextOverflow] = useState(false);
    const [playerLabelKey, setPlayerLabelKey] = useState(configData.playerLabelSettings.default);
    const [template, setTemplate] = useState(configData.templateSettings.default);
    const [foldWidth, updateFoldWidth] = useStoredChoice('foldWidth', FOLD.presets.map(preset => preset.width), FOLD.default);
    const [backgroundKey, updateBackgroundKey] = useStoredChoice('background', BACKGROUNDS.map(background => background.key), configData.backgroundSettings.default);
    const backgroundSrc = BACKGROUNDS.find(background => background.key === backgroundKey)!.src;
    const {overlayImage, loadImageFile, handleImageChange, updatePlacement, resetPlacement, resetImage} = useOverlayImage();
    const [isDraggingImage, setIsDraggingImage] = useState(false);

    // Les valeurs saisies sont conservées quand on change de modèle, seuls libellés et styles changent
    const displayedFields = useMemo(() => fields
        .filter(field => !field.templates || field.templates.includes(template))
        .map(field => applyTemplate(field, template)), [fields, template]);
    const separators = TEMPLATE_OPTIONS.find(option => option.key === template)?.separators ?? NO_SEPARATORS;
    const playerLabel = displayedFields.find(field => field.key === playerLabelKey)?.value ?? '';

    // Élargir le pli fait remonter la partie joueurs et raccourcit l'illustration
    const foldOffset = foldWidth - FOLD.width;
    const fold = useMemo<FoldLayout>(() => ({
        offset: foldOffset,
        stretchZones: FOLD.stretchZones as [number, number][]
    }), [foldOffset]);
    const overlayFrame = useMemo(() => ({
        ...OVERLAY_FRAME,
        height: OVERLAY_FRAME.height - foldOffset
    }), [foldOffset]);
    const playerLabelStyle = useMemo(() => ({
        ...PLAYER_LABEL_STYLE,
        y: PLAYER_LABEL_STYLE.y - foldOffset
    }), [foldOffset]);

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

        const nameField = fields.find(f => f.key === 'nom');
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
        const updatedFields = fields.map(field =>
            attributes[field.key] ? {...field, value: attributes[field.key]} : field
        );

        setFields(updatedFields);
        setModalOpen(false);
    };

    const handleCanvasReady = (canvasRefFromChild: React.RefObject<HTMLCanvasElement>) => {
        if (canvasRefFromChild && canvasRefFromChild.current) {
            canvasRef.current = canvasRefFromChild.current;
        }
    };

    // Dépôt d'une image sur la zone de rendu
    const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDraggingImage(true);
    };

    const handleImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        // Ignorer le passage au-dessus des éléments enfants (le canvas)
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsDraggingImage(false);
        }
    };

    const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingImage(false);
        const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
        if (file) loadImageFile(file);
    };

    const handleInfoClick = () => {
        setInfoModalOpen(true);
    };

    const renderField = (field: Field) => (
        <div key={`param-group-${field.id}`} className={`param-group width-${field.fieldSize ?? '100'}`}>
            <label htmlFor={`text-${field.id}`}>{field.label}</label>
            <FieldInput field={field} onChange={handleTextChange}/>
            {field.type === 'editor' && textOverflow && (
                <p className="field-warning">Le texte dépasse du bas de la carte.</p>
            )}
        </div>
    );

    return (
        <div className="app-container">
            <header className="banner">
                <div className="brand">
                    <img src={logoImage} alt="" className="logo"/>
                    <h1>Memento Creatus</h1>
                </div>

                <nav className="toolbar" aria-label="Actions">
                    <button className="btn btn-ghost" onClick={handleReset} title="Nouveau mémento">
                        <BsPlusCircle/>
                        <span className="btn-label">Nouveau</span>
                    </button>
                    <button className="btn btn-ghost" onClick={handleImportStatblock} title="Importer un statblock">
                        <BsBoxArrowInRight/>
                        <span className="btn-label">Importer un statblock</span>
                    </button>
                    <button className="btn" onClick={handleDownload} title="Télécharger l'image">
                        <BsImage/>
                        <span className="btn-label">{withoutAccents('Télécharger')}</span>
                    </button>
                    <button className="btn-icon" onClick={handleInfoClick} title="À propos" aria-label="À propos">
                        <BsInfoCircle/>
                    </button>
                </nav>
            </header>

            <main className="content">
                <div className="params-panel">
                    <div className="segmented" role="radiogroup" aria-label="Modèle">
                        {TEMPLATE_OPTIONS.map(option => (
                            <button
                                key={option.key}
                                role="radio"
                                aria-checked={template === option.key}
                                className={template === option.key ? 'active' : ''}
                                onClick={() => setTemplate(option.key)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {FIELD_GROUPS.map(group => (
                        <section key={group.key} className={`form-section section-${group.key}`}>
                            <h2>{withoutAccents(group.label)}</h2>
                            <div className="fields">
                                {displayedFields.filter(field => field.group === group.key).map(renderField)}
                            </div>
                        </section>
                    ))}

                    <section className="form-section section-illustration">
                        <h2>Illustration</h2>
                        <div className="fields">
                            <div className="param-group width-100 file-actions">
                                <input
                                    type="file"
                                    id="overlay-image"
                                    className="visually-hidden"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                                <label htmlFor="overlay-image" className="btn btn-secondary btn-small">
                                    <BsImage/>
                                    {overlayImage.isLoaded ? "Remplacer l'image" : 'Choisir une image'}
                                </label>
                                {overlayImage.isLoaded && (
                                    <>
                                        <button className="btn btn-ghost-dark btn-small" onClick={resetPlacement}>
                                            Recentrer
                                        </button>
                                        <button className="btn btn-ghost-dark btn-small" onClick={resetImage}>
                                            Retirer
                                        </button>
                                    </>
                                )}
                            </div>

                            {overlayImage.isLoaded && (
                                <p className="param-group width-100 field-hint">
                                    Glissez l'image sur l'aperçu pour la déplacer, molette pour zoomer.
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="form-section section-layout">
                        <h2>Mise en page</h2>
                        <div className="fields">
                            <div className="param-group width-100">
                                <label htmlFor="player-label">Intitulé côté joueurs</label>
                                <select
                                    id="player-label"
                                    value={playerLabelKey}
                                    onChange={(e) => setPlayerLabelKey(e.target.value)}
                                >
                                    {PLAYER_LABEL_OPTIONS.map(option => (
                                        <option key={option.key} value={option.key}>
                                            {option.label ?? displayedFields.find(field => field.key === option.key)?.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="param-group width-100">
                                <label htmlFor="fold-width">Largeur du pli</label>
                                <select
                                    id="fold-width"
                                    value={foldWidth}
                                    onChange={(e) => updateFoldWidth(Number(e.target.value))}
                                >
                                    {FOLD.presets.map(preset => (
                                        <option key={preset.width} value={preset.width}>
                                            {preset.label} – {(preset.width / PRINT_DPI * 25.4).toFixed(1).replace('.', ',')} mm
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="param-group width-100">
                                <label htmlFor="background">Fond de carte</label>
                                <select
                                    id="background"
                                    value={backgroundKey}
                                    onChange={(e) => updateBackgroundKey(e.target.value)}
                                >
                                    {BACKGROUNDS.map(background => (
                                        <option key={background.key} value={background.key}>{background.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>
                </div>

                <div
                    className={`image-panel${isDraggingImage ? ' dragging' : ''}`}
                    onDragOver={handleImageDragOver}
                    onDragLeave={handleImageDragLeave}
                    onDrop={handleImageDrop}
                >
                    {isDraggingImage && (
                        <div className="drop-hint">{withoutAccents("Déposez l'image ici")}</div>
                    )}
                    <CanvasRenderer
                        fields={displayedFields}
                        playerLabel={playerLabel}
                        playerLabelStyle={playerLabelStyle}
                        overlayImage={overlayImage}
                        overlayFrame={overlayFrame}
                        overlayScaleRange={OVERLAY_SCALE_RANGE}
                        onOverlayChange={updatePlacement}
                        fold={fold}
                        backgroundSrc={backgroundSrc}
                        separators={separators}
                        onCanvasReady={handleCanvasReady}
                        onTextOverflow={setTextOverflow}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                    />
                </div>
            </main>

            <Modal
                open={modalOpen}
                titleContent={<h3>Importer un bloc de statistiques</h3>}
                primaryFn={handleImportAttributes}
                secondaryFn={() => setModalOpen(false)}
                cancelFn={() => setModalOpen(false)}
                content={<div>Copiez et collez un bloc de statistiques provenant d'un PDF. Vous pouvez sélectionner tout le bloc, du nom de la créature jusqu'à la fin de ses descriptions (capacités, équipement…) : les attaques et les descriptions sont ajoutées au bloc Texte.<br /><StatBlock ref={statBlockRef}/></div>}
            />

            <Modal
                open={infoModalOpen}
                titleContent={<h3>A propos de Memento Creatus</h3>}
                cancelFn={() => setInfoModalOpen(false)}
                content={
                    <div>
                        <p>Memento Creatus est un créateur de mementos pour Chroniques Oubliées V2.</p>
                        <p>Il s'agit d'un projet non officiel et open source.</p>
                        <p>Version: 0.1</p>
                        <p>Pour plus d'informations, visitez le <a href="https://github.com/Gimond/mementos-creatus" target="_blank" rel="noopener noreferrer">dépôt GitHub</a>.</p>
                        <p>Vous ne voyez pas de bannière de cookies ? C'est normal, ce site n'en utilise pas.</p>
                    </div>
                }
            />

        </div>
    );
}

export default App;