import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { VendorReport, SaleTotals } from "@/types/sales";
import { formatBRL } from "./sales-utils";

// Cores Fiorenzza (RGB)
const COLORS = {
  gold: [212, 168, 68] as [number, number, number],
  peach: [245, 196, 161] as [number, number, number],
  dark: [30, 35, 40] as [number, number, number],
  lightGray: [248, 249, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Failed to get canvas context"));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function generateSalesReportPDF(
  vendorReport: VendorReport[],
  totals: SaleTotals,
  periodLabel: string
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let currentY = 15;

  // Carregar logo e centralizar
  try {
    const logoData = await loadImage("/fiorenzza.png");
    const logoWidth = 50;
    const logoHeight = 25;
    const logoX = (pageWidth - logoWidth) / 2;
    doc.addImage(logoData, "PNG", logoX, currentY, logoWidth, logoHeight);
    currentY += logoHeight + 8;
  } catch (e) {
    console.warn("Logo não carregada:", e);
    currentY += 10;
  }

  // Título
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Vendas por Vendedor", pageWidth / 2, currentY, { align: "center" });
  currentY += 8;

  // Período e data
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${periodLabel}`, pageWidth / 2, currentY, { align: "center" });
  currentY += 6;
  doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  // Resumo Geral - Box
  const boxHeight = 24;
  doc.setFillColor(...COLORS.peach);
  doc.roundedRect(15, currentY, pageWidth - 30, boxHeight, 3, 3, "F");

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO GERAL", 20, currentY + 7);

  doc.setFont("helvetica", "normal");
  const resumoTexto = [
    `Total Líquido: ${formatBRL(totals.liquidoAtivas)}`,
    `Vendas Ativas: ${totals.totalAtivas}`,
    `Itens: ${totals.itensAtivas}`,
    `Desconto: ${formatBRL(totals.descAtivas)}`,
    `% Canceladas: ${totals.pctCancel.toFixed(1)}%`,
  ].join("   |   ");
  doc.text(resumoTexto, 20, currentY + 16);
  currentY += boxHeight + 10;

  // Tabela de vendedores
  autoTable(doc, {
    head: [["Vendedor", "Vendas", "Itens", "Bruto", "Desconto", "Líquido", "% Cancel."]],
    body: vendorReport.map((r) => [
      r.vendedor,
      r.vendas.toString(),
      r.itens.toString(),
      formatBRL(r.bruto),
      formatBRL(r.desconto),
      formatBRL(r.liquido),
      `${r.pctCancel.toFixed(1)}%`,
    ]),
    startY: currentY,
    headStyles: {
      fillColor: COLORS.gold,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: "bold" },
      5: { fontStyle: "bold", textColor: COLORS.gold },
    },
  });

  // Rodapé
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Gerado automaticamente pelo Sistema Fiorenzza",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // Salvar PDF
  const fileName = `relatorio-vendas-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
