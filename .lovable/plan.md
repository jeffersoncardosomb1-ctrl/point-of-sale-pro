

## Plano: Separação de valores por forma de pagamento + campo Observações

### Resumo
Adicionar campos para informar quanto foi pago em cada forma de pagamento selecionada, exibir esses valores como colunas separadas na lista de vendas, e incluir um campo de observações no pedido.

### 1. Migração do Banco de Dados

Adicionar novas colunas nas tabelas `orders` e `sales`:

```sql
-- Valores por forma de pagamento
ALTER TABLE public.orders ADD COLUMN pgto_pix numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN pgto_cartao numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN pgto_dinheiro numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN pgto_boleto numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN pgto_outros numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN observacoes text NOT NULL DEFAULT '';

ALTER TABLE public.sales ADD COLUMN pgto_pix numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN pgto_cartao numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN pgto_dinheiro numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN pgto_boleto numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN pgto_outros numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN observacoes text NOT NULL DEFAULT '';
```

### 2. Formulário de Novo Pedido (`NewOrderForm.tsx`)

- Para cada forma de pagamento selecionada via checkbox, exibir um campo de input numérico ao lado para o vendedor informar o valor pago naquela forma (ex: "PIX: R$ ___", "Dinheiro: R$ ___").
- Adicionar campo de texto "Observações" no resumo do pedido (textarea).
- Adicionar estado: `pgtoValues: Record<PaymentMethod, number>` e `observacoes: string`.
- No submit, enviar os valores individuais junto com a observação.

### 3. Interface `NewOrderFormProps` e `createOrder`

- Atualizar a interface para incluir `pgtoValues` e `observacoes`.
- No `useOrdersSupabase.ts`, salvar os novos campos `pgto_pix`, `pgto_cartao`, etc. e `observacoes` tanto na tabela `orders` quanto nas linhas de `sales`.

### 4. Tipos TypeScript

- Adicionar ao `Sale` em `types/sales.ts`: `pgtoPix`, `pgtoCartao`, `pgtoDinheiro`, `pgtoBoleto`, `pgtoOutros`, `observacoes`.
- Adicionar ao `Order` em `types/order.ts`: os mesmos campos.

### 5. Lista de Vendas (`SalesListView.tsx`)

Substituir as colunas atuais "Pgto", "Pago", "Troco" por:
- **Pgto PIX** — valor pago via PIX
- **Pgto Cartão** — valor pago via Cartão
- **Pgto Dinheiro** — valor pago via Dinheiro
- **Outros** — soma de Boleto + Outros
- **Observações** — texto livre

Colunas finais da tabela:
`Data/Hora | Status | Vendedor | Código | Produto | Qtd | Unit. | Desc. | Líquido | Pgto PIX | Pgto Cartão | Pgto Dinheiro | Outros | Observações | Ações`

### 6. Hook `useSalesSupabase.ts`

- Atualizar `dbRowToSale` para mapear os novos campos.
- Atualizar `saleToDbRow` para incluir os novos campos no insert.

### 7. Exportação Excel (`sales-utils.ts`)

- Atualizar `exportSalesToExcel` para incluir as novas colunas de pagamento e observações.

### Arquivos Afetados
- Nova migração SQL (6 colunas em `orders` + 6 em `sales`)
- `src/types/sales.ts` — novos campos no `Sale`
- `src/types/order.ts` — novos campos no `Order`
- `src/components/orders/NewOrderForm.tsx` — inputs de valor por forma + observações
- `src/hooks/useOrdersSupabase.ts` — salvar novos campos
- `src/hooks/useSalesSupabase.ts` — ler/mapear novos campos
- `src/components/sales/SalesListView.tsx` — novas colunas na tabela
- `src/lib/sales-utils.ts` — exportação Excel atualizada

