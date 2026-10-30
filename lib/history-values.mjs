// Normalize legacy numeric strings without altering source records.
export const sheetNumber=value=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&/^-?\d+(?:\.\d+)?$/.test(value.trim())?Number(value):null;
export function numericHistoryRow(row){const copy=[...row];for(const index of [5,6,7,11,19])copy[index]=sheetNumber(copy[index]);return copy;}
