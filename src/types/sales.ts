export interface Sale {
  id: string;
  createdAt: string;
  vendedor: string;
  barcode: string;
  productName: string; // Novo campo
  quantidade: number;
  valorUnitario: number;
  totalBruto: number;
  desconto: number;
  totalLiquido: number;
  valorPago: number;
  troco: number;
  formaPagamento: PaymentMethod;
  status: SaleStatus;
  cancelMotivo: string;
  canceledAt: string;
}

export interface Seller {
  id: string;
  name: string;
}

export type SaleStatus = "ATIVA" | "CANCELADA";
export type PaymentMethod = "PIX" | "CARTAO" | "DINHEIRO" | "BOLETO" | "OUTROS";
export type StatusFilter = "TODAS" | "ATIVAS" | "CANCELADAS";
export type PeriodFilter = "HOJE" | "7D" | "30D" | "TUDO" | "CUSTOM";

export interface VendorReport {
  vendedor: string;
  vendas: number;
  itens: number;
  bruto: number;
  desconto: number;
  liquido: number;
  pago: number;
  diferenca: number;
  pctCancel: number;
}

export interface SaleTotals {
  totalRegistros: number;
  totalAtivas: number;
  totalCanceladas: number;
  pctCancel: number;
  itensAtivas: number;
  brutoAtivas: number;
  descAtivas: number;
  liquidoAtivas: number;
  pagoAtivas: number;
  diferenca: number;
}