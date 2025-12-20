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
  cancelMotivo: string;
  canceledAt: string;
  items: OrderItem[];
}
