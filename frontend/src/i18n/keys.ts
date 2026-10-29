// Translation key helpers. The engine keeps the original English card names as identifiers
// (game rules depend on them: muster, tight bond, ...); only the displayed text is translated.

/** "Geralt of Rivia" -> "geralt_of_rivia", "Síle de Tansarville" -> "sile_de_tansarville" */
export function cardKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** engine notification names use dashes ("me-coin"), message keys use underscores */
export const notificationKey = (name: string) => 'notifications.' + name.replace(/-/g, '_')
