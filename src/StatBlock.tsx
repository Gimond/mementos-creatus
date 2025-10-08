import React, {forwardRef, useImperativeHandle, useState} from 'react';

interface StatBlockProps {
    setCreatureFromStatBlock?: (attributes: any) => void;
}

const StatBlock = forwardRef<{ attributes: any }, StatBlockProps>((props, ref) => {
    const [statblock, setStatblock] = useState<string>();

    // Ajout de la propriété attributes avec useState
    const [attributes, setAttributes] = useState<any>({});

    // Exposer les attributs via la ref
    useImperativeHandle(ref, () => ({
        attributes: attributes
    }));

    const buildRegexp = (obj: Record<string, string>) => {
        var res = "\\b(";
        var premier = true;
        for (var field in obj) {
            if (premier) {
                res += field;
                premier = false;
            } else {
                res += "|" + field;
            }
        }
        res += "|créature)\\b"; //pour la version accentuée
        return new RegExp(res, 'gi');
    };

    const handleStatBlockChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newStatBlock = event.target.value;
        setStatblock(newStatBlock);
        const parsedAttributes = parseStatBlock(newStatBlock);

        // Mise à jour des attributs sera faite dans parseStatBlock
        if (typeof props.setCreatureFromStatBlock === 'function') {
            props.setCreatureFromStatBlock(parsedAttributes);
        }
    };

    const parseStatBlock = (statBlock: string) => {
        var maxAttack = 0;
        var statsReconnues = {
            nom: 'Nom',
            agi: 'AGI',
            con: 'CON',
            for: 'FOR',
            per: 'PER',
            cha: 'CHA',
            int: 'INT',
            vol: 'VOL',
            nc: 'NC',
            niveau: 'NC',
            taille: 'Taille',
            init: 'Init',
            def: 'DEF',
            pv: 'PV',
            creature: 'Type',
        };
        var patternStats = buildRegexp(statsReconnues);

        if (statBlock === '') {
            return {};
        }
        let stats = statBlock.replace(/\r/g, '');
        var rows = stats.split(/\n/);
        var newAttrs: any = {};
        newAttrs.attaques = [];
        var previousLine = ''; //Au cas d'attaque sur plusieurs lignes
        var previousContainsDM = false;
        var lastPrefix = ''; //Pour les suites d'attaque sur la ligne suivante
        var firstLine = true; //si la première ligne ne correspond à rien, c'est le nom
        rows.push(' '); // add an empty line at the end to make sure the last row is processed
        rows.forEach(function (row) {
            row = row.trim();
            row.normalize("NFD").replace(/[\u{0080}-\u{FFFF}]/gu,""); // clean unicode characters

            if (row.search(/ \| NC\b/i) >= 0) {
                newAttrs.Nom = row.split(' | ')[0].split('\\')[0].trim();
            }

            if (previousContainsDM) {
                /*
                * ARTHROPODE (GRAND) | NC 5
CRÉATURE VIVANTE TAILLE GRANDE
| AGI +3* | CON +6* | FOR +6* | PER +2 |
| CHA ‑4 | INT ‑4 | VOL +0 |
(
S)DEF 20 ( V)PV 60 ( I)Init. 12
Pinces +10 · DM 2d8+6
Dard +10 · DM 1d6 + poison (2d8, difficulté 15
pour ½ · DM)
                * */
                if (row.search(/\s*·\s*DM\s/i) >= 0) {
                    console.log("La ligne ---" + row + "--- est une nouvelle attaque, on affiche la précédente : " + previousLine);
                    // cette ligne contient des DM c'est une nouvelle attaque, on traite la précédente
                    var {nomAttaque, bonusAttaque, DM} = parseAttaque(previousLine);
                    newAttrs.attaques.push('<b>' + nomAttaque.trim() + '</b> ' + bonusAttaque.trim() + ' · <b>DM</b> ' + DM);

                    previousLine = row + ' ';
                    previousContainsDM = true;
                } else {
                    console.log("La ligne ---" + row + "--- est la suite d'une attaque, on l'affiche avec la ligne précédente précédente : " + previousLine);
                    // cette ligne ne contient pas DM, c'est la suite de la ligne précédente
                    var currentRow = previousLine + row;
                    var {nomAttaque, bonusAttaque, DM} = parseAttaque(currentRow);
                    newAttrs.attaques.push('<b>' + nomAttaque.trim() + '</b> ' + bonusAttaque.trim() + ' · <b>DM</b> ' + DM);

                    previousContainsDM = false;
                    previousLine = '';
                }
            } else if (row.search(/\s*·\s*DM\s/i) >= 0) {
                console.log("La ligne " + row + " est une attaque mais sera traitée au prochain tour");
                previousLine += row + ' ';
                previousContainsDM = true;
            } else if (row.startsWith('+') && lastPrefix !== '') {
                newAttrs[lastPrefix + 'spec'] += row;
            } else { //Pas attaque
                lastPrefix = '';
                var lexemes: any[] = [];
                var lastMatch;
                var match = patternStats.exec(row);
                while (match) {
                    if (lastMatch) {
                        lexemes.push({
                            match: lastMatch,
                            end: match.index
                        });
                    }
                    lastMatch = match;
                    match = patternStats.exec(row);
                }
                if (lastMatch) {
                    lexemes.push({
                        match: lastMatch,
                        end: row.length
                    });
                }
                if (lexemes.length === 0) {
                    if (firstLine) {
                        newAttrs.nom = row;
                    } else {
                        // console.log("La ligne " + row + " ne correspond à rien");
                        previousLine = row + ' ';
                    }
                } else previousLine = '';
                lexemes.forEach(function (l) {
                    var lstat = l.match[0].toLowerCase();
                    var lattr = statsReconnues[lstat as keyof typeof statsReconnues];
                    if (lattr === undefined && lstat === 'créature') lattr = statsReconnues.creature;
                    if (lattr === undefined) {
                        console.log("Erreur ! Pattern " + lstat + " non reconnue. La ligne était " + l);
                        return;
                    }
                    var valAttr = row.substring(l.match.index + lstat.length, l.end).trim();
                    valAttr = valAttr.replace(/\([\s\n]*[SVI]\)/g, ''); // nettoyage des caractères issus des icones

                    if (lattr.search(/(AGI|CON|FOR|PER|CHA|INT|VOL)/) !== -1) {
                        valAttr = valAttr.replace(/[\s|\.]/g, '');
                    } else if (lattr.search(/(Init|DEF|PV|NC)/) !== -1) {
                        valAttr = valAttr.replace(/[\s|\.]/g, '');
                    }
                    newAttrs[lattr] = valAttr;
                });
            }
            firstLine = false;
        });
        newAttrs.max_attack_label = maxAttack;

        setAttributes(newAttrs);
        return newAttrs;
    };

    const parseAttaque = (line: string) => {
        var AttaqueLine = line.split(/ · (.*)/s);
        var Attaque = AttaqueLine[0].trim();
        var DM = AttaqueLine[1]?.trim() || '';

        var nomAttaque = "";
        var bonusAttaque = "";
        Attaque.split(' ').forEach(function (n) {
            if (n.match(/\([^)]\)/i) !== null || n.match(/(\+\d+)/i) !== null) {
                bonusAttaque += n + " ";
            } else {
                nomAttaque += n + " ";
            }
        });

        DM = DM.replace('DM', '').trim();

        return {
            nomAttaque,
            bonusAttaque,
            DM
        };
    };

    return (
        <form>
            <textarea value={statblock} onChange={handleStatBlockChange} />
        </form>
    );
});

export default StatBlock;