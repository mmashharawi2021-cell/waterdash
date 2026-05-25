import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { DailyReport } from '../types/Report';

// 1. Daily Report PDF Export Utility
export function exportDailyReportPDF(report: DailyReport): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Since jsPDF requires a custom font to render full Arabic characters, 
  // we build a premium, print-ready, bilingual layout in English/Arabic 
  // to ensure official audits can read the document universally.

  // Page Width
  const pw = doc.internal.pageSize.getWidth();
  
  // Header Block (Institutional style)
  doc.setFillColor(15, 23, 42); // Dark slate top
  doc.rect(0, 0, pw, 35, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PALESTINIAN WATER AUTHORITY", 15, 15);
  doc.setFontSize(10);
  doc.setTextColor(186, 230, 253);
  doc.text("Water Pumping & Operations Dashboard - Daily Report", 15, 22);
  doc.text("سلطة المياه الفلسطينية - تقرير التشغيل والضخ اليومي", 15, 27);

  // Logo Placeholder
  doc.setDrawColor(255, 255, 255);
  doc.rect(pw - 35, 8, 20, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("LOGO / الشعار", pw - 34, 19);

  // General Metadata
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("Helvetica", "bold");
  doc.text("GENERAL DETAILS / معلومات عامة", 15, 47);
  
  doc.setDrawColor(226, 232, 240);
  doc.line(15, 49, pw - 15, 49);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Station Name / المحطة:  ${report.stationName}`, 15, 56);
  doc.text(`Report Date / تاريخ التقرير:  ${report.date}`, 15, 62);
  doc.text(`Operating Hours / ساعات التشغيل:  ${report.generator.formattedOperatingHours}  (${report.generator.operatingHours} hours)`, 15, 68);

  // Section 1: Generator and Water Operations
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text("WATER PRODUCTION & EFFICIENCY / كميات وضخ المياه والإنتاج", 15, 80);
  doc.line(15, 82, pw - 15, 82);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9.5);
  
  // Table 1 Water
  const waterData = [
    ["Parameter / المؤشر", "Volume / الحجم (m3)", "Details / تفاصيل"],
    ["Total Water In / إجمالي الداخل", `${report.waterQuantities.totalWaterIn} m3`, "Operating Hours * Submersible Production Rate"],
    ["Daily Production / الإنتاج المحلى", `${report.waterQuantities.dailyProduction} m3`, "Operating Hours * Filtered Production Rate"],
    ["Waste Water / المياه العادمة", `${report.waterQuantities.wasteWater} m3`, "Total Water In - Daily Production"],
    ["Recovery Rate / معدل الاسترجاع", `${report.waterQuantities.recoveryRate}%`, "Ratio of desalinated to total water in"],
    ["Waste Rate / معدل الفاقد", `${report.waterQuantities.wasteRate}%`, "Ratio of waste to total water in"]
  ];

  let currentY = 88;
  waterData.forEach((row, idx) => {
    if (idx === 0) {
      doc.setFont("Helvetica", "bold");
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY - 4, pw - 30, 7, 'F');
    } else {
      doc.setFont("Helvetica", "normal");
    }
    doc.text(row[0], 17, currentY);
    doc.text(row[1], 85, currentY);
    doc.text(row[2], 120, currentY);
    
    doc.line(15, currentY + 2, pw - 15, currentY + 2);
    currentY += 8;
  });

  // Section 2: Fuel Operations
  currentY += 4;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text("FUEL BALANCE & LOGISTICS / السولار والمحروقات اليومية", 15, currentY);
  doc.line(15, currentY + 2, pw - 15, currentY + 2);
  currentY += 8;

  const fuelData = [
    ["Fuel Category / الفئة", "Liters / لتر", "Description / التفاصيل"],
    ["Previous Balance / الرصيد السابق", `${report.fuel.previousBalance} L`, "Fetched chronologically from previous day"],
    ["Added Fuel / المضاف يومياً", `${report.fuel.addedFuel} L`, "Fuel quantity refilled during current shift"],
    ["Supplied by Municipality / المورد", `${report.fuel.suppliedFromMunicipality} L`, "Fuel supplied from Municipal Council"],
    ["Consumed Fuel / المستهلك يومياً", `${report.fuel.consumedFuel} L`, "Generator consumed fuel quantity"],
    ["Current Balance / الرصيد المتبقي", `${report.fuel.currentBalance} L`, "Current remaining fuel volume in tank"]
  ];

  fuelData.forEach((row, idx) => {
    if (idx === 0) {
      doc.setFont("Helvetica", "bold");
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY - 4, pw - 30, 7, 'F');
    } else {
      doc.setFont("Helvetica", "normal");
      if (idx === 5) {
        doc.setFont("Helvetica", "bold");
        doc.setFillColor(240, 253, 244); // light green highlighted for balance
        doc.rect(15, currentY - 4, pw - 30, 7, 'F');
      }
    }
    doc.text(row[0], 17, currentY);
    doc.text(row[1], 85, currentY);
    doc.text(row[2], 120, currentY);
    
    doc.line(15, currentY + 2, pw - 15, currentY + 2);
    currentY += 8;
  });

  // Section 3: Lab Quality Tests & Beneficiaries
  currentY += 4;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text("LAB QUALITY TESTS / فحوصات جودة ومختبر المياه", 15, currentY);
  doc.line(15, currentY + 2, pw - 15, currentY + 2);
  currentY += 8;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Desalinated PH / أس هيدروجيني محلى:  ${report.labTests.phDesalination}`, 15, currentY);
  doc.text(`Submersible PH / أس هيدروجيني غاطس:  ${report.labTests.phSubmersible}`, 105, currentY);
  currentY += 6;
  doc.text(`Desalinated TDS / ملوحة محلاه:  ${report.labTests.tdsDesalinated} mg/L`, 15, currentY);
  doc.text(`Well TDS / ملوحة بئر مياه:  ${report.labTests.tdsWell} mg/L`, 105, currentY);
  currentY += 6;
  doc.text(`Waste TDS / ملوحة مياه عادمة:  ${report.labTests.tdsWaste} mg/L`, 15, currentY);
  doc.text(`Free Chlorine / الكلور الحر:  ${report.labTests.freeChlorine} mg/L`, 105, currentY);

  // Section 4: Beneficiaries
  currentY += 12;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BENEFICIARIES & DISTRIBUTION / الجهات المستفيدة والتوزيع", 15, currentY);
  doc.line(15, currentY + 2, pw - 15, currentY + 2);
  currentY += 8;

  doc.setFont("Helvetica", "bold");
  doc.setFillColor(241, 245, 249);
  doc.rect(15, currentY - 4, pw - 30, 7, 'F');
  doc.text("Agency / الجهة المستفيدة", 17, currentY);
  doc.text("Quantity / الكمية (m3)", 95, currentY);
  doc.text("Cars / عدد السيارات", 150, currentY);
  doc.line(15, currentY + 2, pw - 15, currentY + 2);
  currentY += 8;

  doc.setFont("Helvetica", "normal");
  report.beneficiaries.forEach((b) => {
    if (currentY > 260) {
      doc.addPage();
      currentY = 20; // reset
    }
    doc.text(b.agencyName, 17, currentY);
    doc.text(`${b.quantity} m3`, 95, currentY);
    doc.text(`${b.numberOfCars} cars`, 150, currentY);
    doc.line(15, currentY + 2, pw - 15, currentY + 2);
    currentY += 8;
  });

  // Beneficiaries Totals
  doc.setFont("Helvetica", "bold");
  doc.text("Total Distribution / إجمالي التوزيع", 17, currentY);
  doc.text(`${report.beneficiariesTotals.totalQuantity} m3`, 95, currentY);
  doc.text(`${report.beneficiariesTotals.totalCars} cars`, 150, currentY);
  doc.line(15, currentY + 2, pw - 15, currentY + 2);

  // Official Approvals & Signature Block
  currentY += 16;
  if (currentY > 255) {
    doc.addPage();
    currentY = 30;
  }

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("OFFICIAL APPROVALS & SIGNATURES / الاعتمادات والتوقيعات الرسمية", 15, currentY);
  doc.line(15, currentY + 2, pw - 15, currentY + 2);
  currentY += 12;

  doc.setFontSize(9.5);
  doc.text("Prepared By (Operator) / مشغل المحطة:", 15, currentY);
  doc.text("Approved By (Engineer) / المهندس المسؤول:", 115, currentY);
  
  currentY += 14;
  doc.setFont("Helvetica", "normal");
  doc.text("Signature: __________________________", 15, currentY);
  doc.text("Signature: __________________________", 115, currentY);

  // Save the PDF
  doc.save(`WaterDash_Report_${report.date}_${report.stationName.replace(/\s+/g, '_')}.pdf`);
}

// 2. Monthly Reports Excel Sheet Export Utility
export function exportMonthlyReportsExcel(reports: DailyReport[], yearMonth: string): void {
  // Map our complex objects into flat structure suitable for standard sheet audits
  const flatRows = reports.map((r) => {
    // Flatten lab tests
    const lab = r.labTests || {};
    const fuel = r.fuel || {};
    const gen = r.generator || {};
    const water = r.waterQuantities || {};
    const totals = r.beneficiariesTotals || {};

    // Get list of agency names for excel summary cell
    const agenciesSummary = r.beneficiaries
      ?.map((b) => `${b.agencyName} (${b.quantity} m³)` )
      .join(' | ') || '';

    return {
      "التاريخ (Date)": r.date,
      "اسم المحطة (Station)": r.stationName,
      "ساعات البدء (Start)": gen.startTime || '',
      "ساعات الإيقاف (End)": gen.endTime || '',
      "ساعات التشغيل (Hours)": gen.operatingHours || 0,
      "ساعات التنسيق (Formatted)": gen.formattedOperatingHours || '00:00',
      "رصيد الوقود السابق (Prev Fuel Balance)": fuel.previousBalance || 0,
      "الوقود المضاف (Added Fuel)": fuel.addedFuel || 0,
      "المورد من البلدية (Municipal Fuel)": fuel.suppliedFromMunicipality || 0,
      "الوقود المستهلك (Consumed Fuel)": fuel.consumedFuel || 0,
      "رصيد الوقود الحالي (Current Fuel Balance)": fuel.currentBalance || 0,
      "إجمالي المياه الداخلة (Total Water In)": water.totalWaterIn || 0,
      "الإنتاج اليومي المحلى (Daily Production)": water.dailyProduction || 0,
      "المياه العادمة (Waste Water)": water.wasteWater || 0,
      "معدل الاسترجاع (Recovery Rate %)": `${water.recoveryRate || 0}%`,
      "معدل الفاقد (Waste Rate %)": `${water.wasteRate || 0}%`,
      "PH بعد التحلية": lab.phDesalination || 0,
      "PH مياه الغاطس": lab.phSubmersible || 0,
      "TDS مياه محلاة": lab.tdsDesalinated || 0,
      "TDS بئر مياه": lab.tdsWell || 0,
      "TDS مياه عادمة": lab.tdsWaste || 0,
      "الكلور الحر (Free Chlorine)": lab.freeChlorine || 0,
      "إجمالي كميات التوزيع (Total Dist m3)": totals.totalQuantity || 0,
      "إجمالي السيارات (Total Cars)": totals.totalCars || 0,
      "تفصيل التوزيع (Distribution Details)": agenciesSummary
    };
  });

  // Create Sheet
  const ws = XLSX.utils.json_to_sheet(flatRows);

  // Auto-fit Column Widths for readability
  const maxKeys = flatRows.length > 0 ? Object.keys(flatRows[0]) : [];
  const colWidths = maxKeys.map((key) => {
    let maxLength = key.length;
    flatRows.forEach((row: any) => {
      const val = row[key];
      if (val !== undefined && val !== null) {
        maxLength = Math.max(maxLength, String(val).length);
      }
    });
    return { wch: Math.min(maxLength + 3, 40) }; // cap width
  });
  ws['!cols'] = colWidths;

  // Create Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reports Consolidated");

  // Write Excel file
  XLSX.writeFile(wb, `WaterDash_Monthly_Report_${yearMonth}.xlsx`);
}
