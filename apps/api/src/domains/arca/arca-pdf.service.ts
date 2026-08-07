import { Injectable } from '@nestjs/common';

export type InvoicePdfInput = {
  businessName: string;
  cae: string;
  caeExpiration: string;
  cuit: string;
  customerName: string;
  issueDate: string;
  lines: Array<{ description: string; quantity: number; totalCents: number }>;
  pointOfSale: number;
  qrUrl: string;
  totalAmountCents: number;
  voucherNumber: number;
  voucherTypeLabel: string;
};

/**
 * Minimal PDF generator (no external deps).
 * Produces a valid single-page PDF with invoice summary text.
 */
@Injectable()
export class ArcaPdfService {
  buildPdf(input: InvoicePdfInput): Buffer {
    const lines = [
      input.businessName,
      `CUIT: ${formatCuit(input.cuit)}`,
      `${input.voucherTypeLabel}  PV ${String(input.pointOfSale).padStart(5, '0')}-${String(input.voucherNumber).padStart(8, '0')}`,
      `Fecha: ${input.issueDate}`,
      `Cliente: ${input.customerName || 'Consumidor final'}`,
      '',
      ...input.lines.map(
        (line) =>
          `${line.quantity} x ${line.description}  $${(line.totalCents / 100).toFixed(2)}`,
      ),
      '',
      `Total: $${(input.totalAmountCents / 100).toFixed(2)}`,
      `CAE: ${input.cae}`,
      `Vto CAE: ${input.caeExpiration}`,
      '',
      `QR: ${input.qrUrl.slice(0, 80)}...`,
    ];

    const contentStream = buildTextStream(lines);
    const objects: string[] = [];

    objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
    objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
    objects.push(
      '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n',
    );
    objects.push(
      `4 0 obj<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>stream\n${contentStream}\nendstream\nendobj\n`,
    );
    objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += obj;
    }

    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefStart}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }
}

function buildTextStream(lines: string[]): string {
  const escaped = lines.map((line) => escapePdfText(line));
  let y = 750;
  const ops: string[] = ['BT', '/F1 11 Tf', '50 750 Td'];
  for (let i = 0; i < escaped.length; i += 1) {
    if (i === 0) {
      ops.push(`(${escaped[i]}) Tj`);
    } else {
      y -= 16;
      ops.push(`0 -16 Td (${escaped[i]}) Tj`);
    }
  }
  ops.push('ET');
  return ops.join('\n');
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatCuit(cuit: string): string {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) {
    return cuit;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}
