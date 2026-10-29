// Port of CardContainer.resizeCardContainer(): margins that make cards overlap when a row gets crowded
export function cardRowMargin(n: number, overlap_count: number, gap: number, coef: number): string {
  if (n < overlap_count) return gap + 'vw'
  return 'calc((100% - (4.45vw * ' + n + ')) / (2*' + n + ') - (' + coef + 'vw * ' + n + '))'
}

export const HAND_MARGIN = (n: number) => cardRowMargin(n, 11, 0.075, 0.00225)
export const ROW_MARGIN = (n: number) => cardRowMargin(n, 10, 0.075, 0.00325)
export const WEATHER_MARGIN = (n: number) => cardRowMargin(n, 4, 0.075, 0.045)

/** pile offset (original setCardOffset) */
export const pileOffset = (n: number) => -0.03 * n + 'vw'
