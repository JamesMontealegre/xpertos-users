import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Formato en línea: **negrita**, *cursiva* y `código`. El texto se escapa antes. */
function inline(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function tableCells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

/**
 * Convierte el markdown de los contratos (títulos, negritas, listas, tablas y párrafos) en HTML.
 * Cubre lo que genera la base en `_build_contract`; no es un parser de markdown completo.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      // Dos espacios al final de una línea = salto de línea.
      const html = paragraph
        .map((l, i) => {
          const last = i === paragraph.length - 1;
          const hardBreak = /\s{2,}$/.test(l);
          return inline(l.trimEnd()) + (last ? '' : hardBreak ? '<br>' : ' ');
        })
        .join('');
      out.push(`<p>${html}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      out.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
      list = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      flushList();
      const head = tableCells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(tableCells(lines[i]));
        i++;
      }
      i--;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
      );
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flushParagraph();
      flushList();
      out.push('<hr>');
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return out.join('\n');
}

const CONTRACT_CSS = `
  @page { margin: 18mm 16mm; }
  .xp-contract { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; font-size: 11pt; line-height: 1.45; }
  .xp-contract h1 { font-size: 17pt; color: #083A8C; margin: 0 0 10px; }
  .xp-contract h2 { font-size: 12.5pt; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #E2E8F0; }
  .xp-contract h3 { font-size: 11.5pt; margin: 12px 0 4px; }
  .xp-contract p { margin: 6px 0; }
  .xp-contract ul { margin: 4px 0 8px; padding-left: 20px; }
  .xp-contract table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 10pt; }
  .xp-contract th, .xp-contract td { border: 1px solid #E2E8F0; padding: 5px 7px; text-align: left; vertical-align: top; }
  .xp-contract th { background: #F8FAFC; }
  .xp-contract .xp-footer { margin-top: 24px; font-size: 8.5pt; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 6px; }
`;

type ContractLike = { body_md: string; body_hash: string; version: number };

/** Documento HTML completo del contrato, listo para imprimir o convertir en PDF. */
export function contractHtml(contract: ContractLike): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${CONTRACT_CSS}</style></head><body><div class="xp-contract">${markdownToHtml(
    contract.body_md
  )}<div class="xp-footer">Versión ${contract.version} · Hash SHA-256 ${escapeHtml(contract.body_hash)}</div></div></body></html>`;
}

/**
 * En web, Print.printAsync imprime la página actual: se monta el contrato en un contenedor que es
 * lo único visible al imprimir y se retira al cerrar el diálogo.
 */
async function printOnWeb(contract: ContractLike) {
  const doc = window.document;
  const container = doc.createElement('div');
  container.id = 'xp-contract-print';
  container.innerHTML = `<div class="xp-contract">${markdownToHtml(contract.body_md)}<div class="xp-footer">Versión ${
    contract.version
  } · Hash SHA-256 ${escapeHtml(contract.body_hash)}</div></div>`;
  const style = doc.createElement('style');
  style.id = 'xp-contract-print-style';
  style.textContent = `${CONTRACT_CSS}
    #xp-contract-print { display: none; }
    @media print {
      body > *:not(#xp-contract-print) { display: none !important; }
      #xp-contract-print { display: block !important; }
      html, body { background: #FFFFFF !important; height: auto !important; overflow: visible !important; }
    }`;
  doc.head.appendChild(style);
  doc.body.appendChild(container);

  const previousTitle = doc.title;
  doc.title = 'Contrato Xpertos';
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    container.remove();
    style.remove();
    doc.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  try {
    await Print.printAsync({ html: contractHtml(contract) });
  } finally {
    // window.print() bloquea hasta cerrar el diálogo en la mayoría de navegadores; por si no, se limpia luego.
    setTimeout(cleanup, 1000);
  }
}

/**
 * Descarga el contrato:
 * - iOS/Android: genera el PDF con expo-print y abre la hoja de compartir (guardar en Archivos, enviar…).
 * - Web: abre el diálogo de impresión del navegador (desde ahí se guarda como PDF).
 */
export async function downloadContract(contract: ContractLike): Promise<void> {
  if (Platform.OS === 'web') {
    await printOnWeb(contract);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: contractHtml(contract) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Contrato de prestación de servicios',
    });
  } else {
    await Print.printAsync({ uri });
  }
}
