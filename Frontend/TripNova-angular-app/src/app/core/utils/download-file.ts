import { jsPDF } from 'jspdf';

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadPdfFile(filename: string, lines: string[]): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 17;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 22;
  let y = 27;
  let lineIndex = 0;
  const dayLabels = lines
    .filter((line) => /^DAY \d+/i.test(line.trim()))
    .map((line) => line.trim().replace(/^DAY\s+/i, '').split(':')[0]);

  const addPageHeader = (): void => {
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageWidth, 14, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text('TRIPNOVA', margin, 9);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(203, 213, 225);
    pdf.text('YOUR PERSONAL TRAVEL ITINERARY', pageWidth - margin, 9, { align: 'right' });
    pdf.setTextColor(15, 23, 42);
  };

  const addPage = (): void => {
    pdf.addPage();
    addPageHeader();
    y = 24;
  };

  const ensureSpace = (height: number): void => {
    if (y + height > bottomLimit) addPage();
  };

  addPageHeader();

  for (const line of lines) {
    const trimmed = line.trim();
    const isTitle = lineIndex === 0;
    const isSubtitle = lineIndex === 1;
    const isSection = trimmed.length > 0 && trimmed === trimmed.toUpperCase() && trimmed.length > 3;
    const isDay = /^DAY \d+/i.test(trimmed) || /^\d+\. DAY/i.test(trimmed);
    const isBullet = trimmed.startsWith('- ');

    if (!trimmed) {
      y += 4;
      lineIndex += 1;
      continue;
    }

    if (isTitle) {
      ensureSpace(22);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.setTextColor(15, 23, 42);
      pdf.text(pdf.splitTextToSize(trimmed, contentWidth), margin, y);
      y += 12;
    } else if (isSubtitle) {
      ensureSpace(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(100, 116, 139);
      pdf.text(pdf.splitTextToSize(trimmed, contentWidth), margin, y);
      y += 9;
      pdf.setDrawColor(245, 158, 11);
      pdf.setLineWidth(0.7);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 9;
      if (dayLabels.length) {
        ensureSpace(25);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text('JOURNEY TRACKER', margin, y);
        const trackerY = y + 9;
        const trackerWidth = contentWidth - 8;
        const step = dayLabels.length > 1 ? trackerWidth / (dayLabels.length - 1) : 0;
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(1.2);
        if (dayLabels.length > 1) pdf.line(margin + 4, trackerY, margin + 4 + trackerWidth, trackerY);
        dayLabels.forEach((label, index) => {
          const x = margin + 4 + step * index;
          pdf.setFillColor(245, 158, 11);
          pdf.circle(x, trackerY, 2.8, 'F');
          pdf.setFillColor(255, 255, 255);
          pdf.circle(x, trackerY, 1, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7);
          pdf.setTextColor(51, 65, 85);
          pdf.text(label, x, trackerY + 9, { align: 'center' });
        });
        y += 23;
      }
    } else if (isSection) {
      ensureSpace(13);
      pdf.setFillColor(255, 247, 237);
      pdf.roundedRect(margin, y - 5, contentWidth, 10, 2, 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(146, 64, 14);
      pdf.text(trimmed, margin + 4, y + 1);
      y += 10;
    } else if (isDay) {
      ensureSpace(16);
      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(margin, y - 6, contentWidth, 11, 2, 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text(trimmed, margin + 4, y + 1);
      y += 10;
    } else {
      const wrappedLines = pdf.splitTextToSize(trimmed, contentWidth - (isBullet ? 5 : 0));
      const blockHeight = wrappedLines.length * 5.2 + 1;
      ensureSpace(blockHeight);
      pdf.setFont('helvetica', isBullet ? 'normal' : 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(51, 65, 85);
      if (isBullet) {
        pdf.setFillColor(245, 158, 11);
        pdf.circle(margin + 1.5, y - 1.2, 1, 'F');
        pdf.text(wrappedLines, margin + 6, y);
      } else {
        pdf.text(wrappedLines, margin, y);
      }
      y += blockHeight;
    }
    lineIndex += 1;
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('TripNova · Plan your journey, your way', margin, pageHeight - 8);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  pdf.save(filename);
}
