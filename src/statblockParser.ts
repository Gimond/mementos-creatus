// Analyse d'un bloc de statistiques Chroniques Oubliées V2 copié depuis un PDF.
// Le résultat est indexé par les clés des champs de config.json.
//
// Un statblock se lit en quatre phases successives :
//   1. en-tête      NOM | NC x, éventuelle suite du nom, puis TYPE TAILLE xxx
//   2. stats        | AGI +1 | CON +0 | ... DEF 20 PV 50 Init. 11
//   3. attaques     Nom de l'attaque +10 · DM 1d6+4 (éventuellement sur plusieurs lignes)
//   4. descriptions TITRE : texte..., Équipement : ...

export type StatBlockAttributes = Record<string, string>;

const STAT_KEYWORDS: Record<string, string> = {
    agi: 'agi',
    con: 'con',
    for: 'for',
    per: 'per',
    cha: 'cha',
    int: 'int',
    vol: 'vol',
    def: 'def',
    pv: 'pv',
    init: 'init',
    nc: 'nc',
    niveau: 'nc',
    taille: 'taille',
};
const STAT_PATTERN = new RegExp(`\\b(${Object.keys(STAT_KEYWORDS).join('|')})\\b`, 'gi');
const STATS_LINE = /\b(AGI|CON|FOR|PER|CHA|INT|VOL|DEF|PV)\b/;
const NC_PART = /\s*\|\s*(?:NC|NIVEAU)\s*(.*)$/i;
const ATTACK_START = /·\s*DM\s/i;
// "SERGENT :", "GARDE DU CORPS :", "Équipement : ...", "Déplacement : ..."
const DESCRIPTION_START = /^\p{Lu}[^:·]{0,40}\s:/u;
const SEPARATOR = '<br/>---<br/>';

const cleanLine = (line: string) => line
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '') // caractères de contrôle issus des icônes du PDF
    .replace(/[\u2010-\u2015\u2212]/g, '-') // tirets et signes moins typographiques
    .replace(/\u00A0/g, ' ') // espaces insécables
    .trim();

// Recolle une ligne à la précédente en supprimant la césure ("supplémen-" + "taire")
const joinLines = (previous: string, next: string) => /\p{L}-$/u.test(previous)
    ? previous.slice(0, -1) + next
    : `${previous} ${next}`;

const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const parseHeader = (lines: string[], attributes: StatBlockAttributes) => {
    const nameParts: string[] = [];

    lines.forEach((line, index) => {
        const ncMatch = line.match(NC_PART);
        if (ncMatch) {
            attributes.nc = ncMatch[1].replace(/[\s.]/g, '');
            line = line.replace(NC_PART, '');
        }

        const isTypeLine = index === lines.length - 1 && index > 0;
        if (isTypeLine) {
            const [type, size] = line.split(/\bTAILLE\b/i);
            attributes.type = type.trim();
            if (size !== undefined) {
                attributes.taille = size.trim();
            }
        } else if (index === 0 || !ncMatch) {
            nameParts.push(line);
        }
    });

    attributes.nom = nameParts.join(' ').trim();
};

const parseStats = (lines: string[], attributes: StatBlockAttributes) => {
    lines.forEach(line => {
        const matches = [...line.matchAll(STAT_PATTERN)];

        matches.forEach((match, index) => {
            const key = STAT_KEYWORDS[match[0].toLowerCase()];
            const end = matches[index + 1]?.index ?? line.length;
            let value = line.substring(match.index + match[0].length, end)
                .replace(/\([\s\n]*[SVI]\)/g, '') // icônes DEF, PV et Init
                .trim();

            if (key !== 'taille') {
                value = value.replace(/[\s|.]/g, '');
            }
            attributes[key] = value;
        });
    });
};

const formatAttack = (line: string) => {
    const [attack, damage = ''] = line.split(/\s*·\s*(.*)/s);

    const nameParts: string[] = [];
    const bonusParts: string[] = [];
    attack.split(' ').forEach(word => {
        if (/\([^)]\)/.test(word) || /\+\d+/.test(word)) {
            bonusParts.push(word);
        } else {
            nameParts.push(word);
        }
    });

    const dm = damage.replace(/^DM\s*/i, '').trim();
    return `<b>${escapeHtml(nameParts.join(' '))}</b> ${escapeHtml(bonusParts.join(' '))} · <b>DM</b> ${escapeHtml(dm)}`;
};

const formatDescription = (paragraph: string) => {
    const colon = paragraph.indexOf(':');
    if (colon < 0) {
        return escapeHtml(paragraph);
    }
    const title = paragraph.substring(0, colon + 1);
    const text = paragraph.substring(colon + 1).trim();
    return `<b>${escapeHtml(title)}</b> ${escapeHtml(text)}`.trim();
};

export const parseStatBlock = (statBlock: string): StatBlockAttributes => {
    const lines = statBlock.split(/\r?\n/).map(cleanLine).filter(line => line !== '');
    const attributes: StatBlockAttributes = {};
    if (lines.length === 0) {
        return attributes;
    }

    const firstAttack = lines.findIndex(line => ATTACK_START.test(line));
    const attacksStart = firstAttack < 0 ? lines.length : firstAttack;
    const firstStats = lines.findIndex(line => STATS_LINE.test(line));
    const statsStart = firstStats < 0 || firstStats > attacksStart ? attacksStart : firstStats;

    parseHeader(lines.slice(0, statsStart), attributes);
    parseStats(lines.slice(statsStart, attacksStart), attributes);

    const attacks: string[] = [];
    const descriptions: string[] = [];
    for (const line of lines.slice(attacksStart)) {
        if (descriptions.length === 0 && ATTACK_START.test(line)) {
            attacks.push(line);
        } else if (DESCRIPTION_START.test(line)) {
            descriptions.push(line);
        } else if (descriptions.length > 0) {
            descriptions[descriptions.length - 1] = joinLines(descriptions[descriptions.length - 1], line);
        } else {
            // Une ligne sans DM ni titre qui suit une attaque en est la suite
            attacks[attacks.length - 1] = joinLines(attacks[attacks.length - 1], line);
        }
    }

    const texte = [
        attacks.map(formatAttack).join(SEPARATOR),
        descriptions.map(formatDescription).join('<br/>'),
    ].filter(part => part !== '').join(SEPARATOR);
    if (texte !== '') {
        attributes.texte = texte;
    }

    return attributes;
};
