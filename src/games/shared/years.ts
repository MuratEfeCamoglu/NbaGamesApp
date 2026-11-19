/**
 * Stint label: start year of the first season – last two digits of the final season's end year.
 * ("2003-04", "2010-11") → "2003–11"; ("2017-18", "2017-18") → "2017–18". En dash, as in the design.
 */
export function formatYears(fromSeason: string, toSeason: string): string {
  return `${fromSeason.slice(0, 4)}–${toSeason.slice(5, 7)}`;
}
