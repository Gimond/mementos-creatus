import React, {forwardRef, useImperativeHandle, useState} from 'react';

interface StatBlockProps {
    setCreatureFromStatBlock?: (attributes: any) => void;
}

const StatBlock = forwardRef<{ attributes: any }, StatBlockProps>((props, ref) => {
    const [statblock, setStatblock] = useState<string>(
        'SHAKAMAK (DÉMON ANCIEN)\\b | NC 1/2\n' +
        'CRÉATURE NON VIVANTE TAILLE TRÈS PETITE\n' +
        '| AGI +1 | CON +1 | FOR +1 | PER +2 |\n' +
        '| CHA +2 | INT +3 | VOL +3 |\n' +
        '(\n' +
        '    S)DEF 13 ( V)PV 9 ( I)Init. 12\n' +
        'Griffes, dents ou tentacules +3 · DM 1d6+1'
    );

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
        var previousLine = ''; //Au cas d'attaque sur plusieurs lignes
        var previousContainsDM = false;
        var lastPrefix = ''; //Pour les suites d'attaque sur la ligne suivante
        var firstLine = true; //si la première ligne ne correspond à rien, c'est le nom
        rows.push(''); // add an empty line at the end to make sure the last row is processed
        rows.forEach(function (row) {
            row = row.trim();
            row.normalize("NFD").replace(/[\u{0080}-\u{FFFF}]/gu,""); // clean unicode characters

            if (row.search(/ \| NC\b/i) >= 0) {
                newAttrs.Nom = row.split(' | ')[0].split('\\')[0].trim();
            }

            if (row.search(/\s·\sDM\b/i) >= 0) {
                previousLine += row + ' ';
                previousContainsDM = true;
            } else if (previousContainsDM || row.search(/\s·\sDM\b/i) >= 0) { //Attaque

                if (row.search(/\s·\sDM\b/i) >= 0) {
                    // cette ligne contient des DM c'est une nouvelle attaque, on traite la précédente
                    var currentRow = previousLine;
                } else {
                    // cette ligne ne contient pas DM, c'est la suite de la ligne précédente
                    var currentRow = previousLine + row;
                }

                var AttaqueLine = currentRow.split(' · ');
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

                if (!newAttrs.attaques) {
                    newAttrs.attaques = [];
                }
                newAttrs.attaques.push(
                    '<b>' + nomAttaque.trim() + '</b> ' + bonusAttaque.trim() + ' · <b>DM</b> ' + DM
                );

                previousContainsDM = false;
                previousLine = '';
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

        console.log(newAttrs);

        setAttributes(newAttrs);
        return newAttrs;
    };

    return (
        <form>
            <textarea value={statblock} onChange={handleStatBlockChange} />
        </form>
    );
});

export default StatBlock;