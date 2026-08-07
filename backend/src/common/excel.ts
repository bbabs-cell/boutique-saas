import ExcelJS from 'exceljs';

/**
 * Génération et lecture de classeurs Excel.
 *
 * Passé de `xlsx` (SheetJS sur npm) à `exceljs` : le paquet npm `xlsx` n'est plus maintenu et
 * traîne deux vulnérabilités sans correctif publié (prototype pollution et ReDoS), alors qu'il
 * sert précisément à analyser un fichier fourni par l'utilisateur. `exceljs` est maintenu et
 * couvre exactement les besoins d'ici : quelques feuilles, des colonnes plates, aucune formule.
 *
 * L'écriture et la lecture sont asynchrones avec exceljs — c'est la seule différence visible
 * pour les appelants.
 */

export interface SheetDefinition {
  name: string;
  /** En-têtes, dans l'ordre voulu. Les lignes sont lues via ces mêmes clés. */
  columns: string[];
  rows: Record<string, unknown>[];
}

/** Construit un classeur en mémoire et le rend sous forme de Buffer prêt à être téléchargé. */
export async function buildWorkbookBuffer(sheets: SheetDefinition[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map((header) => ({ header, key: header }));

    for (const row of sheet.rows) {
      worksheet.addRow(row);
    }

    // Ligne d'en-tête en gras : purement cosmétique, mais c'est ce qu'attend quelqu'un qui
    // ouvre le fichier dans Excel ou LibreOffice.
    worksheet.getRow(1).font = { bold: true };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/**
 * Lit la première feuille d'un classeur et rend ses lignes indexées par en-tête.
 * Une cellule vide donne une chaîne vide plutôt que `undefined`, pour que les appelants
 * puissent traiter « absent » et « vide » de la même façon.
 */
export async function readFirstSheetRows(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  // Le typage de `load` d'exceljs attend un `Buffer` de sa propre définition, incompatible à la
  // compilation avec celui de @types/node récent. Les deux décrivent la même donnée à l'exécution.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(normalizeCellValue(cell.value) ?? '').trim();
  });

  const rows: Record<string, unknown>[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // ligne d'en-tête

    const entry: Record<string, unknown> = {};
    for (let colNumber = 1; colNumber < headers.length; colNumber++) {
      const header = headers[colNumber];
      if (!header) continue;
      entry[header] = normalizeCellValue(row.getCell(colNumber).value) ?? '';
    }

    // Une ligne entièrement vide n'est pas une donnée : Excel en laisse souvent traîner en fin
    // de fichier, et elles produiraient autant d'erreurs « nom manquant » à l'import.
    const hasContent = Object.values(entry).some((value) => String(value).trim() !== '');
    if (hasContent) {
      rows.push(entry);
    }
  });

  return rows;
}

/**
 * Ramène une valeur de cellule exceljs à un scalaire simple. Une cellule peut porter du texte
 * enrichi, une formule avec son résultat, ou un lien — l'import n'a besoin que de la valeur.
 */
function normalizeCellValue(value: ExcelJS.CellValue): string | number | Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value;

  if (typeof value === 'object') {
    if ('result' in value && value.result !== undefined) {
      return normalizeCellValue(value.result as ExcelJS.CellValue);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
  }

  return String(value);
}
