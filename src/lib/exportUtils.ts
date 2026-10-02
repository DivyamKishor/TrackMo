import { jsPDF } from 'jspdf';
import { MonthlySummary, TransactionItem } from '../shared/types.ts';
import { formatShortDate } from '../shared/calculations.ts';

function formatPdfAmount(amount: number, prefix = ''): string {
  const absVal = Math.abs(amount);
  const hasDecimals = Math.round(absVal * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(absVal);
  return `${prefix}Rs. ${formatted}`;
}

export function exportMonthlyReportPDF(
  ownerName: string,
  summary: MonthlySummary
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 22;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${ownerName} — ${summary.monthLabel}`, margin, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('TrackMo Family Money Statement', margin, y);

  // Summary Box
  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 34, 2, 2, 'FD');

  const col1X = margin + 6;
  const col2X = pageWidth / 2 + 4;
  let boxY = y + 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Starting Balance:', col1X, boxY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const startPrefix = summary.startingBalance < 0 ? '-' : '';
  doc.text(formatPdfAmount(summary.startingBalance, startPrefix), col1X + 38, boxY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Money Received:', col2X, boxY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(formatPdfAmount(summary.receivedThisMonth, '+'), col2X + 36, boxY);

  boxY += 9;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Spent:', col1X, boxY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatPdfAmount(summary.spentThisMonth, '-'), col1X + 38, boxY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Remaining Balance:', col2X, boxY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const remPrefix = summary.remainingBalance < 0 ? '-' : '';
  doc.text(formatPdfAmount(summary.remainingBalance, remPrefix), col2X + 36, boxY);

  boxY += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Formula: ${formatPdfAmount(summary.startingBalance, startPrefix)} carried forward + ${formatPdfAmount(
      summary.receivedThisMonth
    )} received - ${formatPdfAmount(summary.spentThisMonth)} spent = ${formatPdfAmount(
      summary.remainingBalance,
      remPrefix
    )}`,
    col1X,
    boxY
  );

  y += 44;

  // Category Breakdown (if expenses exist)
  if (summary.categoryBreakdown.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Spending by Category', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    for (const cat of summary.categoryBreakdown) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(51, 65, 85);
      doc.text(`${cat.category} (${cat.count})`, margin + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${formatPdfAmount(cat.amount)}  (${cat.percentage}%)`,
        pageWidth - margin - 2,
        y,
        { align: 'right' }
      );
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    }
    y += 5;
  }

  // Transactions Table Header
  if (y > 255) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Transactions (${summary.transactions.length})`, margin, y);
  y += 5;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const dateX = margin + 3;
  const catX = margin + 26;
  const descX = margin + 68;
  const amtX = pageWidth - margin - 3;

  doc.text('Date', dateX, y + 5.3);
  doc.text('Category', catX, y + 5.3);
  doc.text('Description', descX, y + 5.3);
  doc.text('Amount', amtX, y + 5.3, { align: 'right' });

  y += 13;

  // Sort chronologically for statement readability (or keep newest first)
  const chronological = [...summary.transactions].sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.id - b.id
  );

  if (chronological.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No transactions recorded for this month.', margin + 3, y);
  } else {
    for (const tx of chronological) {
      if (y > 276) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);

      doc.text(formatShortDate(tx.date), dateX, y);

      const categoryText =
        tx.type === 'income' ? 'Money Received' : tx.category;
      doc.text(categoryText.slice(0, 22), catX, y);

      let descParts: string[] = [];
      if (tx.type === 'income' && tx.source) {
        descParts.push(tx.source);
      }
      if (tx.note) {
        descParts.push(tx.note);
      }
      if (tx.type === 'expense' && tx.paymentMethod) {
        descParts.push(`[${tx.paymentMethod}]`);
      }
      const descText =
        descParts.length > 0 ? descParts.join(' - ') : tx.category;
      doc.text(descText.slice(0, 42), descX, y);

      if (tx.type === 'income') {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(formatPdfAmount(tx.amount, '+'), amtX, y, { align: 'right' });
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formatPdfAmount(tx.amount, '-'), amtX, y, { align: 'right' });
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 2.5, pageWidth - margin, y + 2.5);
      y += 7.5;
    }
  }

  const safeName = ownerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeMonth = summary.monthKey;
  doc.save(`TrackMo_${safeName}_${safeMonth}.pdf`);
}

export function exportTransactionsCSV(
  ownerName: string,
  label: string,
  transactions: TransactionItem[]
): void {
  const headers = [
    'Date',
    'Type',
    'Category',
    'Source',
    'Description / Note',
    'Payment Method',
    'Amount (INR)',
  ];

  const sorted = [...transactions].sort((a, b) =>
    a.date !== b.date ? b.date.localeCompare(a.date) : b.id - a.id
  );

  const escapeCsv = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = sorted.map((tx) => {
    const signedAmount = tx.type === 'income' ? tx.amount : -tx.amount;
    return [
      escapeCsv(tx.date),
      escapeCsv(tx.type === 'income' ? 'Money Received' : 'Expense'),
      escapeCsv(tx.category),
      escapeCsv(tx.source || ''),
      escapeCsv(tx.note || ''),
      escapeCsv(tx.paymentMethod || ''),
      escapeCsv(signedAmount),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  const safeName = ownerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.setAttribute('download', `TrackMo_${safeName}_${safeLabel}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
