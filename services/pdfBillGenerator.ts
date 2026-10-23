import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bill, Invoice, User } from '../types';
import { formatDisplayDate } from './dataSanitizer';

export interface BillPdfOptions {
  bill?: Bill;
  invoice?: Invoice;
  patientUser?: Partial<User> | null;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  hospitalEmail?: string;
  hospitalWebsite?: string;
}

/**
 * Cached base64 logo string to avoid re-fetching on multiple downloads.
 */
let cachedLogoBase64: string | null = null;

/**
 * Attempts to load an image URL into a base64 Data URL.
 */
async function loadBase64Image(url: string): Promise<string | null> {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        cachedLogoBase64 = result;
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Draws a sharp, high-precision vector medical logo fallback directly with jsPDF primitives.
 */
function drawVectorLogo(doc: jsPDF, x: number, y: number, size: number) {
  // Outer soft rounded badge
  doc.setFillColor(0, 87, 168); // MediConnect Primary Blue
  doc.roundedRect(x, y, size, size, 3, 3, 'F');

  // Decorative inner subtle border
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.roundedRect(x + 1, y + 1, size - 2, size - 2, 2, 2, 'S');

  // White medical cross
  doc.setFillColor(255, 255, 255);
  const cx = x + size / 2;
  const cy = y + size / 2;
  const armThickness = size * 0.28;
  const armLength = size * 0.65;

  // Vertical bar
  doc.roundedRect(cx - armThickness / 2, cy - armLength / 2, armThickness, armLength, 1, 1, 'F');
  // Horizontal bar
  doc.roundedRect(cx - armLength / 2, cy - armThickness / 2, armLength, armThickness, 1, 1, 'F');

  // Center accent teal dot
  doc.setFillColor(0, 168, 150); // MediConnect Teal
  doc.circle(cx, cy, armThickness * 0.35, 'F');
}

/**
 * Generates and triggers the download of an official, beautifully aligned MediConnect Bill / Invoice PDF.
 */
export async function downloadBillPdf(options: BillPdfOptions): Promise<void> {
  const {
    bill,
    invoice,
    patientUser,
    hospitalName = 'MediConnect HMS',
    hospitalAddress = '123 Health City Parkway, Suite 500, MedCity, MC 75001',
    hospitalPhone = '+1 (800) 555-0199',
    hospitalEmail = 'billing@mediconnect.org',
    hospitalWebsite = 'www.mediconnect.hms',
  } = options;

  // Derive consolidated billing metadata
  const invoiceId = invoice?.invoiceNumber || (invoice?.id ? `INV-${invoice.id}` : (bill?.id ? `BILL-${bill.id}` : 'INV-2024-001'));
  const patientName = invoice?.patientName || patientUser?.name || 'Valued Patient';
  const patientId = invoice?.patientId || bill?.patientId || patientUser?.id || 'PAT-001';
  const patientEmail = patientUser?.email || 'patient.billing@mediconnect.org';

  const rawIssueDate = invoice?.issueDate || bill?.date || new Date().toISOString().split('T')[0];
  const issueDate = formatDisplayDate(rawIssueDate);
  const rawDueDate = invoice?.dueDate || rawIssueDate;
  const dueDate = formatDisplayDate(rawDueDate);

  const rawStatus = (invoice?.status || bill?.status || 'Due').toUpperCase();
  const isPaid = rawStatus === 'PAID';
  const isOverdue = rawStatus === 'OVERDUE';
  const statusDisplay = isPaid ? 'PAID IN FULL' : isOverdue ? 'OVERDUE' : 'PAYMENT DUE';

  // Build line items
  type ItemRow = { index: number; description: string; category: string; rate: number; total: number };
  let items: ItemRow[] = [];

  if (invoice?.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
    items = invoice.items.map((item, idx) => ({
      index: idx + 1,
      description: item.description || `Medical Service Item ${idx + 1}`,
      category: item.description.toLowerCase().includes('consult') ? 'Clinical Consultation'
        : item.description.toLowerCase().includes('lab') || item.description.toLowerCase().includes('panel') ? 'Diagnostics & Pathology'
        : item.description.toLowerCase().includes('x-ray') || item.description.toLowerCase().includes('mri') ? 'Radiology & Imaging'
        : item.description.toLowerCase().includes('mg') || item.description.toLowerCase().includes('tablet') ? 'Pharmacy & Medication'
        : 'Healthcare Service',
      rate: Number(item.amount || 0),
      total: Number(item.amount || 0),
    }));
  } else if (bill) {
    items = [{
      index: 1,
      description: bill.service || 'Comprehensive Medical Consultation & Services',
      category: 'General Clinical Care',
      rate: Number(bill.amount || 0),
      total: Number(bill.amount || 0),
    }];
  } else {
    items = [{
      index: 1,
      description: 'General Medical Services',
      category: 'Clinical Care',
      rate: 150.00,
      total: 150.00,
    }];
  }

  const subtotal = items.reduce((acc, curr) => acc + curr.total, 0);
  const taxAmount = 0.00; // Standard medical services tax exemption
  const totalAmount = invoice?.totalAmount ?? (bill?.amount ?? subtotal);
  const amountPaid = isPaid ? totalAmount : 0.00;
  const balanceDue = isPaid ? 0.00 : totalAmount;

  // Initialize jsPDF document (Portrait A4)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const leftMargin = 14;
  const rightMargin = 14;
  const usableWidth = pageWidth - leftMargin - rightMargin;

  // =========================================================================
  // 1. TOP BRAND ACCENT BAR
  // =========================================================================
  doc.setFillColor(0, 87, 168); // #0057A8 primary medical blue
  doc.rect(0, 0, pageWidth * 0.72, 3.5, 'F');
  doc.setFillColor(0, 168, 150); // #00A896 teal accent
  doc.rect(pageWidth * 0.72, 0, pageWidth * 0.28, 3.5, 'F');

  // =========================================================================
  // 2. HEADER: HOSPITAL LOGO & NAME + INVOICE METADATA
  // =========================================================================
  const headerTopY = 12;

  // Load image logo or draw crisp vector logo
  const logoData = await loadBase64Image('/logo-icon.png') || await loadBase64Image('/logo.png');
  const logoSize = 15; // 15mm x 15mm
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', leftMargin, headerTopY, logoSize, logoSize);
    } catch {
      drawVectorLogo(doc, leftMargin, headerTopY, logoSize);
    }
  } else {
    drawVectorLogo(doc, leftMargin, headerTopY, logoSize);
  }

  // Hospital Name & Brand Typography
  const textStartX = leftMargin + logoSize + 4;
  doc.setTextColor(0, 87, 168); // Primary brand color
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(hospitalName, textStartX, headerTopY + 5.5);

  doc.setTextColor(0, 168, 150); // Teal subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ADVANCED HEALTHCARE & CLINICAL EXCELLENCE', textStartX, headerTopY + 9.5);

  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`${hospitalAddress}`, textStartX, headerTopY + 13.5);
  doc.text(`Phone: ${hospitalPhone}  |  Email: ${hospitalEmail}  |  ${hospitalWebsite}`, textStartX, headerTopY + 17);

  // Right Header: INVOICE Title & Metadata
  const rightX = pageWidth - rightMargin;
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', rightX, headerTopY + 6, { align: 'right' });

  doc.setTextColor(71, 85, 105); // Slate 600
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(invoiceId, rightX, headerTopY + 11.5, { align: 'right' });

  // Status Badge Pill (Right Side)
  const badgeWidth = 36;
  const badgeHeight = 7;
  const badgeX = rightX - badgeWidth;
  const badgeY = headerTopY + 14;

  if (isPaid) {
    doc.setFillColor(220, 252, 231); // Green 100
    doc.setDrawColor(34, 197, 94);   // Green 500
    doc.setTextColor(21, 128, 61);   // Green 700
  } else if (isOverdue) {
    doc.setFillColor(254, 226, 226); // Red 100
    doc.setDrawColor(239, 68, 68);   // Red 500
    doc.setTextColor(185, 28, 28);   // Red 700
  } else {
    doc.setFillColor(254, 240, 138); // Yellow 100
    doc.setDrawColor(234, 179, 8);   // Yellow 500
    doc.setTextColor(161, 98, 7);    // Yellow 700
  }

  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(statusDisplay, badgeX + badgeWidth / 2, badgeY + 4.8, { align: 'center' });

  // Decorative Horizontal Divider
  const dividerY = headerTopY + 24;
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(leftMargin, dividerY, pageWidth - rightMargin, dividerY);

  // =========================================================================
  // 3. INFORMATION CARDS: BILL TO & INVOICE DETAILS
  // =========================================================================
  const cardTopY = dividerY + 4;
  const cardHeight = 27;
  const cardGap = 6;
  const cardWidth = (usableWidth - cardGap) / 2;

  // Box 1: Patient Information (Bill To)
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, cardTopY, cardWidth, cardHeight, 2, 2, 'FD');

  // Header band for Box 1
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(leftMargin, cardTopY, cardWidth, 6, 2, 2, 'F');
  doc.rect(leftMargin, cardTopY + 4, cardWidth, 2, 'F'); // square bottom corners of top band
  doc.setTextColor(0, 87, 168);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('BILL TO (PATIENT)', leftMargin + 4, cardTopY + 4.2);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(patientName, leftMargin + 4, cardTopY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Patient ID: ${patientId}`, leftMargin + 4, cardTopY + 15.5);
  doc.text(`Email: ${patientEmail}`, leftMargin + 4, cardTopY + 19.5);
  doc.text(`Account Status: Verified Patient`, leftMargin + 4, cardTopY + 23.5);

  // Box 2: Billing & Facility Information
  const box2X = leftMargin + cardWidth + cardGap;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(box2X, cardTopY, cardWidth, cardHeight, 2, 2, 'FD');

  // Header band for Box 2
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(box2X, cardTopY, cardWidth, 6, 2, 2, 'F');
  doc.rect(box2X, cardTopY + 4, cardWidth, 2, 'F');
  doc.setTextColor(0, 87, 168);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('INVOICE & PROVIDER DETAILS', box2X + 4, cardTopY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Invoice Date:', box2X + 4, cardTopY + 11);
  doc.text('Payment Due:', box2X + 4, cardTopY + 15.5);
  doc.text('Billing Facility:', box2X + 4, cardTopY + 19.5);
  doc.text('Provider Reg / Tax ID:', box2X + 4, cardTopY + 23.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(issueDate, box2X + cardWidth - 4, cardTopY + 11, { align: 'right' });
  doc.text(dueDate, box2X + cardWidth - 4, cardTopY + 15.5, { align: 'right' });
  doc.text('MediConnect Central', box2X + cardWidth - 4, cardTopY + 19.5, { align: 'right' });
  doc.text('MC-9948201', box2X + cardWidth - 4, cardTopY + 23.5, { align: 'right' });

  // =========================================================================
  // 4. ITEMIZED BILLING TABLE (AutoTable)
  // =========================================================================
  const tableStartY = cardTopY + cardHeight + 6;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: leftMargin, right: rightMargin },
    head: [['#', 'SERVICE / ITEM DESCRIPTION', 'CATEGORY / DEPARTMENT', 'RATE', 'AMOUNT']],
    body: items.map(item => [
      item.index,
      item.description,
      item.category,
      `$${item.rate.toFixed(2)}`,
      `$${item.total.toFixed(2)}`
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [0, 87, 168], // MediConnect Primary
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 44, halign: 'left' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
  });

  // Position after table
  const finalY = (doc as any).lastAutoTable?.finalY ?? (tableStartY + 30);

  // =========================================================================
  // 5. TOTALS SUMMARY & HOSPITAL STAMP SECTION
  // =========================================================================
  const summaryBoxWidth = 75;
  const summaryBoxX = pageWidth - rightMargin - summaryBoxWidth;
  const summaryY = finalY + 5;

  // Subtotal row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', summaryBoxX, summaryY + 4);
  doc.text(`$${subtotal.toFixed(2)}`, rightX, summaryY + 4, { align: 'right' });

  // Tax row
  doc.text('Healthcare Tax (0% Exempt):', summaryBoxX, summaryY + 9);
  doc.text(`$${taxAmount.toFixed(2)}`, rightX, summaryY + 9, { align: 'right' });

  // Total Billed Highlight Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(0, 87, 168);
  doc.setLineWidth(0.4);
  doc.roundedRect(summaryBoxX - 2, summaryY + 12, summaryBoxWidth + 2, 9, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 87, 168);
  doc.text('TOTAL AMOUNT:', summaryBoxX + 2, summaryY + 18);
  doc.text(`$${totalAmount.toFixed(2)}`, rightX - 2, summaryY + 18, { align: 'right' });

  // Paid / Balance Due breakdown
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Amount Paid:', summaryBoxX, summaryY + 26);
  doc.setTextColor(21, 128, 61); // Green
  doc.text(`$${amountPaid.toFixed(2)}`, rightX, summaryY + 26, { align: 'right' });

  doc.setTextColor(71, 85, 105);
  doc.text('Balance Due:', summaryBoxX, summaryY + 31);
  if (isPaid) {
    doc.setTextColor(21, 128, 61);
    doc.text('$0.00', rightX, summaryY + 31, { align: 'right' });
  } else {
    doc.setTextColor(185, 28, 28); // Red
    doc.setFont('helvetica', 'bold');
    doc.text(`$${balanceDue.toFixed(2)}`, rightX, summaryY + 31, { align: 'right' });
  }

  // Left Side Notes & Payment Methods
  const notesWidth = usableWidth - summaryBoxWidth - 10;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, summaryY, notesWidth, 34, 2, 2, 'FD');

  doc.setTextColor(0, 87, 168);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PAYMENT INSTRUCTIONS & POLICIES', leftMargin + 4, summaryY + 5);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('• Payments can be remitted online via Patient Portal or at any hospital cashier desk.', leftMargin + 4, summaryY + 10);
  doc.text(`• Reference Invoice Number "${invoiceId}" when submitting bank transfers or checks.`, leftMargin + 4, summaryY + 14.5);
  doc.text('• Direct billing accepted for approved health insurance networks & third-party payers.', leftMargin + 4, summaryY + 19);
  doc.text('• For questions regarding this statement, please contact Patient Accounts at (800) 555-0199.', leftMargin + 4, summaryY + 23.5);

  if (isPaid) {
    doc.setTextColor(21, 128, 61);
    doc.setFont('helvetica', 'bold');
    doc.text('✓ This invoice has been PAID IN FULL. Thank you for your payment.', leftMargin + 4, summaryY + 29);
  } else {
    doc.setTextColor(161, 98, 7);
    doc.setFont('helvetica', 'bold');
    doc.text(`⏱ Balance due by ${dueDate}. Prompt settlement is appreciated.`, leftMargin + 4, summaryY + 29);
  }

  // =========================================================================
  // 6. OFFICIAL DIGITAL SEAL & SIGNATURE BLOCK
  // =========================================================================
  const authY = summaryY + 38;

  // Digital Hospital Stamp
  doc.setDrawColor(0, 87, 168);
  doc.setLineWidth(0.4);
  doc.circle(leftMargin + 15, authY + 10, 8, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(0, 87, 168);
  doc.text('MEDICONNECT', leftMargin + 15, authY + 8, { align: 'center' });
  doc.text('OFFICIAL SEAL', leftMargin + 15, authY + 11.5, { align: 'center' });
  doc.text('VERIFIED', leftMargin + 15, authY + 14.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Digitally verified and generated through MediConnect Healthcare Management System.', leftMargin + 27, authY + 9);
  doc.text('Valid without physical rubber stamp when verified against patient portal records.', leftMargin + 27, authY + 13);

  // Authorized Signatory Line on Right
  const sigX = rightX - 55;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(sigX, authY + 14, rightX, authY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Authorized Finance Officer', sigX + 27.5, authY + 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Department of Hospital Revenue & Billing', sigX + 27.5, authY + 21.5, { align: 'center' });

  // =========================================================================
  // 7. FOOTER
  // =========================================================================
  const footerY = pageHeight - 14;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(leftMargin, footerY, pageWidth - rightMargin, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `© ${new Date().getFullYear()} MediConnect HMS. All rights reserved. | Licensed Healthcare Facility #MC-7721-OP`,
    leftMargin,
    footerY + 5
  );
  doc.text(
    `Page 1 of 1  •  Issued on ${issueDate}`,
    pageWidth - rightMargin,
    footerY + 5,
    { align: 'right' }
  );

  // Save PDF file with clean naming
  const safePatientName = patientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeInvoiceId = invoiceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `MediConnect_Bill_${safeInvoiceId}_${safePatientName}.pdf`;

  doc.save(fileName);
}
