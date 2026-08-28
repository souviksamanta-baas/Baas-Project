import { formatCurrency } from './sellCart';
import { escapeHtml, shareHtmlAsPdf } from './sharePdf';
import { purchaseStatusLabel, type PurchaseRecord } from './purchases';

export async function sharePurchasePdf(purchase: PurchaseRecord): Promise<void> {
  const linesHtml = purchase.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.productName)}</td>
        <td>${line.quantity}</td>
        <td style="text-align:right">${escapeHtml(formatCurrency(line.lineTotalCents))}</td>
      </tr>`,
    )
    .join('');

  const html = `
    <html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; }
      h1 { font-size: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      td, th { border-bottom: 1px solid #e2e8f0; padding: 8px 4px; font-size: 13px; text-align: left; }
      .meta { color: #64748b; font-size: 13px; }
      .total { font-size: 16px; font-weight: 700; margin-top: 16px; text-align: right; }
    </style></head><body>
      <h1>Compra ${escapeHtml(purchase.number)}</h1>
      <p class="meta">Proveedor: ${escapeHtml(purchase.supplier || '—')}</p>
      <p class="meta">Fecha: ${escapeHtml(purchase.date)}</p>
      <p class="meta">Estado: ${escapeHtml(purchaseStatusLabel(purchase.status))}</p>
      <table>
        <thead><tr><th>Producto</th><th>Cant.</th><th style="text-align:right">Costo</th></tr></thead>
        <tbody>${linesHtml}</tbody>
      </table>
      <p class="total">Total: ${escapeHtml(formatCurrency(purchase.totalCostCents))}</p>
    </body></html>`;

  await shareHtmlAsPdf({
    fileName: `compra-${purchase.number}.pdf`,
    html,
    shareTitle: `Compra ${purchase.number}`,
  });
}
