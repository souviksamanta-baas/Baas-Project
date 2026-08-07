import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import type { TaxCondition, VoucherTypeCode } from './arca.types';

export type InvoicePdfInput = {
  businessName: string;
  cae: string;
  caeExpiration: string;
  cuit: string;
  customerDocumentNumber?: string | null;
  customerDocumentType?: string | null;
  customerName: string;
  customerTaxCondition?: TaxCondition | null;
  emitterAddress?: string | null;
  emitterTaxCondition: TaxCondition;
  fantasyName?: string | null;
  iibb?: string | null;
  issueDate: string;
  lines: Array<{
    description: string;
    quantity: number;
    totalCents: number;
    unitPriceCents?: number;
  }>;
  pointOfSale: number;
  qrUrl: string;
  startOfActivities?: string | null;
  totalAmountCents: number;
  voucherNumber: number;
  voucherType: VoucherTypeCode;
  voucherTypeCode: number;
};

const TAX_LABELS: Record<TaxCondition, string> = {
  consumidor_final: 'Consumidor Final',
  exento: 'IVA Exento',
  monotributo: 'Responsable Monotributo',
  no_responsable: 'IVA No Responsable',
  responsable_inscripto: 'IVA Responsable Inscripto',
};

/**
 * AFIP/ARCA electronic invoice representation (Factura A/B/C and NC/ND).
 * Layout follows the regulated comprobante model: letter box, emitter/receptor,
 * detail without IVA discrimination for C, CAE + QR footer.
 */
@Injectable()
export class ArcaPdfService {
  async buildPdf(input: InvoicePdfInput): Promise<Buffer> {
    const qrPng = await QRCode.toBuffer(input.qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      type: 'png',
      width: 160,
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        autoFirstPage: true,
        margins: { bottom: 36, left: 36, right: 36, top: 36 },
        size: 'A4',
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        drawAfipInvoice(doc, input, qrPng);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

function drawAfipInvoice(
  doc: PDFKit.PDFDocument,
  input: InvoicePdfInput,
  qrPng: Buffer,
): void {
  const pageW = doc.page.width;
  const margin = 36;
  const contentW = pageW - margin * 2;
  const left = margin;
  const right = pageW - margin;
  let y = margin;

  const letter = voucherLetter(input.voucherType);
  const title = voucherTitle(input.voucherType);
  const code = String(input.voucherTypeCode).padStart(3, '0');
  const pv = String(input.pointOfSale).padStart(5, '0');
  const nro = String(input.voucherNumber).padStart(8, '0');
  const isTypeC = letter === 'C';

  // ORIGINAL banner
  strokeRect(doc, left, y, contentW, 18);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('ORIGINAL', left, y + 4, { align: 'center', width: contentW });
  y += 22;

  const headerH = 122;
  const letterColW = 78;
  const leftColW = Math.floor(contentW * 0.5);
  const rightColW = contentW - leftColW - letterColW;
  const letterX = left + leftColW;
  const rightX = letterX + letterColW;

  strokeRect(doc, left, y, contentW, headerH);
  vline(doc, letterX, y, headerH);
  vline(doc, rightX, y, headerH);

  // Emitter (left)
  const emitterName = input.businessName || 'Emisor';
  doc.font('Helvetica-Bold').fontSize(11).text(emitterName, left + 6, y + 8, {
    width: leftColW - 12,
  });
  let ey = Math.min(doc.y + 2, y + headerH - 70);
  if (input.fantasyName && input.fantasyName !== emitterName) {
    doc.font('Helvetica').fontSize(8).text(`Nombre de fantasía: ${input.fantasyName}`, left + 6, ey, {
      width: leftColW - 12,
    });
    ey = doc.y + 2;
  }
  if (input.emitterAddress) {
    doc.font('Helvetica').fontSize(8).text(input.emitterAddress, left + 6, ey, {
      width: leftColW - 12,
    });
    ey = doc.y + 2;
  }
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(`CUIT: ${formatCuit(input.cuit)}`, left + 6, Math.min(ey, y + headerH - 52), {
      width: leftColW - 12,
    });
  ey = doc.y + 1;
  doc.text(
    `Condición frente al IVA: ${TAX_LABELS[input.emitterTaxCondition]}`,
    left + 6,
    ey,
    { width: leftColW - 12 },
  );
  ey = doc.y + 1;
  doc.text(`Ingresos Brutos: ${input.iibb?.trim() || 'Exento'}`, left + 6, ey, {
    width: leftColW - 12,
  });
  ey = doc.y + 1;
  doc.text(
    `Inicio de actividades: ${formatDateEs(input.startOfActivities) || '—'}`,
    left + 6,
    ey,
    { width: leftColW - 12 },
  );

  // Letter box (center)
  const boxSize = 48;
  const boxX = letterX + (letterColW - boxSize) / 2;
  const boxY = y + 22;
  doc.lineWidth(2);
  strokeRect(doc, boxX, boxY, boxSize, boxSize);
  doc.lineWidth(1);
  doc
    .font('Helvetica-Bold')
    .fontSize(30)
    .text(letter, boxX, boxY + 8, { align: 'center', width: boxSize });
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(`COD. ${code}`, letterX, boxY + boxSize + 8, {
      align: 'center',
      width: letterColW,
    });

  // Comprobante (right)
  doc.font('Helvetica-Bold').fontSize(13).text(title, rightX + 6, y + 12, {
    width: rightColW - 12,
  });
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`N° ${pv}-${nro}`, rightX + 6, y + 34, { width: rightColW - 12 });
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(`Fecha de Emisión:`, rightX + 6, y + 56, { width: rightColW - 12 });
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(formatDateEs(input.issueDate), rightX + 6, y + 70, { width: rightColW - 12 });

  y += headerH + 8;

  // Receptor
  const receptorH = 62;
  strokeRect(doc, left, y, contentW, receptorH);
  doc.font('Helvetica-Bold').fontSize(9).text('Datos del Receptor', left + 6, y + 6);
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(
      `Apellido y Nombre / Razón Social: ${input.customerName || 'Consumidor final'}`,
      left + 6,
      y + 22,
      { width: contentW - 12 },
    );
  const docLabel = formatCustomerDoc(
    input.customerDocumentType,
    input.customerDocumentNumber,
  );
  doc.text(docLabel, left + 6, y + 38, { width: contentW * 0.45 });
  doc.text(
    `Condición frente al IVA: ${
      TAX_LABELS[input.customerTaxCondition ?? 'consumidor_final']
    }`,
    left + contentW * 0.45,
    y + 38,
    { width: contentW * 0.52 },
  );
  y += receptorH + 8;

  // Items table
  const colCant = 50;
  const colPUnit = 85;
  const colImp = 95;
  const colDesc = contentW - colCant - colPUnit - colImp;
  const headerRowH = 18;
  const tableTop = y;
  const maxBodyH = 280;

  // Header row
  doc.rect(left, y, contentW, headerRowH).fillAndStroke('#eeeeee', '#000');
  doc.fillColor('#000');
  doc.font('Helvetica-Bold').fontSize(8);
  textCell(doc, 'Cant.', left, y, colCant, headerRowH, 'center');
  textCell(doc, 'Descripción', left + colCant, y, colDesc, headerRowH, 'left');
  textCell(doc, 'Precio Unit.', left + colCant + colDesc, y, colPUnit, headerRowH, 'right');
  textCell(
    doc,
    'Importe',
    left + colCant + colDesc + colPUnit,
    y,
    colImp,
    headerRowH,
    'right',
  );
  y += headerRowH;

  const bodyTop = y;
  doc.font('Helvetica').fontSize(8);
  for (const line of input.lines) {
    const unit =
      line.unitPriceCents ??
      (line.quantity > 0 ? Math.round(line.totalCents / line.quantity) : line.totalCents);
    const descH = Math.max(
      16,
      doc.heightOfString(line.description, { width: colDesc - 10 }) + 8,
    );
    if (y + descH > bodyTop + maxBodyH) {
      break;
    }
    textCell(doc, formatQty(line.quantity), left, y, colCant, descH, 'center');
    textCell(doc, line.description, left + colCant, y, colDesc, descH, 'left');
    textCell(
      doc,
      formatMoneyAr(unit),
      left + colCant + colDesc,
      y,
      colPUnit,
      descH,
      'right',
    );
    textCell(
      doc,
      formatMoneyAr(line.totalCents),
      left + colCant + colDesc + colPUnit,
      y,
      colImp,
      descH,
      'right',
    );
    y += descH;
    hline(doc, left, right, y);
  }

  const bodyBottom = Math.max(y, bodyTop + 80);
  // Outer table border + column guides
  strokeRect(doc, left, tableTop, contentW, bodyBottom - tableTop);
  vline(doc, left + colCant, tableTop, bodyBottom - tableTop);
  vline(doc, left + colCant + colDesc, tableTop, bodyBottom - tableTop);
  vline(doc, left + colCant + colDesc + colPUnit, tableTop, bodyBottom - tableTop);
  hline(doc, left, right, tableTop + headerRowH);

  y = bodyBottom + 8;

  // Totals
  const totalsH = 40;
  strokeRect(doc, left, y, contentW, totalsH);
  if (isTypeC) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .text('Factura C — no discrimina IVA', left + 8, y + 6, { width: contentW / 2 });
  }
  doc.font('Helvetica-Bold').fontSize(12).text('Importe Total', left + 8, y + 18);
  doc.text(formatMoneyAr(input.totalAmountCents), left + contentW / 2, y + 18, {
    align: 'right',
    width: contentW / 2 - 12,
  });
  y += totalsH + 16;

  // Footer: QR + CAE
  const footerTop = Math.min(Math.max(y, 640), 700);
  const qrSize = 108;
  doc.image(qrPng, left, footerTop, { height: qrSize, width: qrSize });

  const caeX = left + qrSize + 18;
  doc.font('Helvetica-Bold').fontSize(11).text(`CAE N°: ${input.cae}`, caeX, footerTop + 18);
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(`Fecha de Vto. de CAE: ${formatDateEs(input.caeExpiration)}`, caeX, footerTop + 38);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Comprobante Autorizado', caeX, footerTop + 58);
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#444444')
    .text(
      'Representación impresa del comprobante electrónico. Podés verificarlo con el código QR o en el sitio de ARCA.',
      caeX,
      footerTop + 76,
      { width: contentW - qrSize - 24 },
    );
  doc.fillColor('#000000');
}

function strokeRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  doc.rect(x, y, w, h).stroke('#000000');
}

function vline(doc: PDFKit.PDFDocument, x: number, y: number, h: number): void {
  doc.moveTo(x, y).lineTo(x, y + h).stroke('#000000');
}

function hline(doc: PDFKit.PDFDocument, x1: number, x2: number, y: number): void {
  doc.moveTo(x1, y).lineTo(x2, y).stroke('#000000');
}

function textCell(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  align: 'left' | 'right' | 'center',
): void {
  const pad = 4;
  doc.text(text, x + pad, y + 4, {
    align,
    height: h - 6,
    width: w - pad * 2,
  });
}

function voucherLetter(type: VoucherTypeCode): string {
  return type.slice(-1);
}

function voucherTitle(type: VoucherTypeCode): string {
  if (type.startsWith('NC')) {
    return 'NOTA DE CRÉDITO';
  }
  if (type.startsWith('ND')) {
    return 'NOTA DE DÉBITO';
  }
  return 'FACTURA';
}

function formatCuit(cuit: string): string {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) {
    return cuit;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

function formatDateEs(value?: string | null): string {
  if (!value) {
    return '';
  }
  const iso = value.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value.replace(/\D/g, '').slice(0, 8));
  if (compact) {
    return `${compact[3]}/${compact[2]}/${compact[1]}`;
  }
  return value;
}

function formatMoneyAr(cents: number): string {
  const amount = cents / 100;
  const formatted = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
  return `$ ${formatted}`;
}

function formatQty(quantity: number): string {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: quantity % 1 === 0 ? 0 : 2,
  }).format(quantity);
}

function formatCustomerDoc(
  documentType?: string | null,
  documentNumber?: string | null,
): string {
  const type = (documentType || 'CF').toUpperCase();
  const number = (documentNumber || '').replace(/\D/g, '');
  if (type === 'CF' || !number || number === '0') {
    return 'Doc.: Consumidor Final';
  }
  if (type === 'CUIT' || type === 'CUIL') {
    return `${type}: ${formatCuit(number)}`;
  }
  return `${type}: ${number}`;
}
