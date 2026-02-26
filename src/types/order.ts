import { PaymentMethod, SaleStatus } from "./sales";

export interface OrderItem {
  id: string;
  barcode: string;
  productName: string;
  quantidade: number;
  valorUnitario: number;
  descontoPercentual: number;
  totalBruto: number;
  desconto: number;
  totalLiquido: number;
}

export interface Order {
  id: string;
  createdAt: string;
  vendedor: string;
  formaPagamento: PaymentMethod;
  status: SaleStatus;
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  valorPago: number;
  troco: number;
  pgtoPix: number;
  pgtoCartao: number;
  pgtoDinheiro: number;
  pgtoBoleto: number;
  pgtoOutros: number;
  observacoes: string;
  cancelMotivo: string;
  canceledAt: string;
  items: OrderItem[];
}
