// La police Rodfat ne contient pas de lettres accentuées
export const withoutAccents = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
