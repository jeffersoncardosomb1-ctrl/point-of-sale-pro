export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          aniversario: string | null
          created_at: string
          id: string
          nome: string
          telefone: string
          updated_at: string
        }
        Insert: {
          aniversario?: string | null
          created_at?: string
          id?: string
          nome: string
          telefone?: string
          updated_at?: string
        }
        Update: {
          aniversario?: string | null
          created_at?: string
          id?: string
          nome?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_count_entries: {
        Row: {
          barcode: string
          client_created_at: string | null
          count_id: string
          created_at: string
          device_id: string
          device_label: string
          id: string
          product_id: string | null
          quantidade: number
          tipo: string
          user_id: string | null
          user_nome: string
        }
        Insert: {
          barcode: string
          client_created_at?: string | null
          count_id: string
          created_at?: string
          device_id?: string
          device_label?: string
          id: string
          product_id?: string | null
          quantidade: number
          tipo?: string
          user_id?: string | null
          user_nome?: string
        }
        Update: {
          barcode?: string
          client_created_at?: string | null
          count_id?: string
          created_at?: string
          device_id?: string
          device_label?: string
          id?: string
          product_id?: string | null
          quantidade?: number
          tipo?: string
          user_id?: string | null
          user_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_entries_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_items: {
        Row: {
          status: string
          rodada_inicio: string | null
          movimentos_durante: number
          saved_at: string | null
          saved_by: string | null
          saved_by_nome: string
          updated_at: string
          a_identificar: boolean
          barcode: string
          contado: boolean
          count_id: string
          created_at: string
          custo_medio: number
          diferenca: number
          id: string
          movement_id: string | null
          product_id: string | null
          product_name: string
          quantidade_contada: number
          saldo_sistema_no_fechamento: number
          valor_diferenca: number
        }
        Insert: {
          status?: string
          rodada_inicio?: string | null
          movimentos_durante?: number
          saved_at?: string | null
          saved_by?: string | null
          saved_by_nome?: string
          updated_at?: string
          a_identificar?: boolean
          barcode: string
          contado?: boolean
          count_id: string
          created_at?: string
          custo_medio?: number
          diferenca?: number
          id?: string
          movement_id?: string | null
          product_id?: string | null
          product_name?: string
          quantidade_contada?: number
          saldo_sistema_no_fechamento?: number
          valor_diferenca?: number
        }
        Update: {
          status?: string
          rodada_inicio?: string | null
          movimentos_durante?: number
          saved_at?: string | null
          saved_by?: string | null
          saved_by_nome?: string
          updated_at?: string
          a_identificar?: boolean
          barcode?: string
          contado?: boolean
          count_id?: string
          created_at?: string
          custo_medio?: number
          diferenca?: number
          id?: string
          movement_id?: string | null
          product_id?: string | null
          product_name?: string
          quantidade_contada?: number
          saldo_sistema_no_fechamento?: number
          valor_diferenca?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          created_by: string | null
          created_by_nome: string
          finalized_at: string | null
          finalized_by: string | null
          finalized_by_nome: string
          id: string
          numero: number
          observacoes: string
          status: Database["public"]["Enums"]["inventory_status"]
          tipo: Database["public"]["Enums"]["inventory_type"] | null
          total_divergencias: number | null
          total_itens: number | null
          valor_antes: number | null
          valor_depois: number | null
          valor_divergencia: number | null
        }
        Insert: {
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nome?: string
          finalized_at?: string | null
          finalized_by?: string | null
          finalized_by_nome?: string
          id?: string
          numero?: number
          observacoes?: string
          status?: Database["public"]["Enums"]["inventory_status"]
          tipo?: Database["public"]["Enums"]["inventory_type"] | null
          total_divergencias?: number | null
          total_itens?: number | null
          valor_antes?: number | null
          valor_depois?: number | null
          valor_divergencia?: number | null
        }
        Update: {
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nome?: string
          finalized_at?: string | null
          finalized_by?: string | null
          finalized_by_nome?: string
          id?: string
          numero?: number
          observacoes?: string
          status?: Database["public"]["Enums"]["inventory_status"]
          tipo?: Database["public"]["Enums"]["inventory_type"] | null
          total_divergencias?: number | null
          total_itens?: number | null
          valor_antes?: number | null
          valor_depois?: number | null
          valor_divergencia?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          cancel_motivo: string | null
          canceled_at: string | null
          client_id: string | null
          client_nome: string
          created_at: string
          forma_pagamento: string
          id: string
          observacoes: string
          pgto_boleto: number
          pgto_cartao: number
          pgto_dinheiro: number
          pgto_outros: number
          pgto_pix: number
          status: Database["public"]["Enums"]["sale_status"]
          total_bruto: number
          total_desconto: number
          total_liquido: number
          troco: number
          updated_at: string
          valor_pago: number
          vendedor: string
        }
        Insert: {
          cancel_motivo?: string | null
          canceled_at?: string | null
          client_id?: string | null
          client_nome?: string
          created_at?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string
          pgto_boleto?: number
          pgto_cartao?: number
          pgto_dinheiro?: number
          pgto_outros?: number
          pgto_pix?: number
          status?: Database["public"]["Enums"]["sale_status"]
          total_bruto?: number
          total_desconto?: number
          total_liquido?: number
          troco?: number
          updated_at?: string
          valor_pago?: number
          vendedor: string
        }
        Update: {
          cancel_motivo?: string | null
          canceled_at?: string | null
          client_id?: string | null
          client_nome?: string
          created_at?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string
          pgto_boleto?: number
          pgto_cartao?: number
          pgto_dinheiro?: number
          pgto_outros?: number
          pgto_pix?: number
          status?: Database["public"]["Enums"]["sale_status"]
          total_bruto?: number
          total_desconto?: number
          total_liquido?: number
          troco?: number
          updated_at?: string
          valor_pago?: number
          vendedor?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          pendente_identificacao: boolean
          updated_at: string
          barcode: string
          cost_avg: number
          created_at: string | null
          id: string
          price: number
          product_name: string
          stock: number
        }
        Insert: {
          category?: string
          pendente_identificacao?: boolean
          updated_at?: string
          barcode: string
          cost_avg?: number
          created_at?: string | null
          id?: string
          price?: number
          product_name: string
          stock?: number
        }
        Update: {
          category?: string
          pendente_identificacao?: boolean
          updated_at?: string
          barcode?: string
          cost_avg?: number
          created_at?: string | null
          id?: string
          price?: number
          product_name?: string
          stock?: number
        }
        Relationships: []
      }
      product_barcodes: {
        Row: {
          barcode: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
        }
        Insert: {
          barcode: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
        }
        Update: {
          barcode?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          is_admin: boolean | null
          last_name: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean | null
          is_admin?: boolean | null
          last_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          last_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      purchase_entries: {
        Row: {
          status: string
          estornada_at: string | null
          estornada_by: string | null
          created_at: string
          file_name: string
          id: string
          observacoes: string
          total_cost: number
          total_items: number
          total_quantity: number
          user_id: string | null
          vendedor: string
        }
        Insert: {
          status?: string
          estornada_at?: string | null
          estornada_by?: string | null
          created_at?: string
          file_name?: string
          id?: string
          observacoes?: string
          total_cost?: number
          total_items?: number
          total_quantity?: number
          user_id?: string | null
          vendedor?: string
        }
        Update: {
          status?: string
          estornada_at?: string | null
          estornada_by?: string | null
          created_at?: string
          file_name?: string
          id?: string
          observacoes?: string
          total_cost?: number
          total_items?: number
          total_quantity?: number
          user_id?: string | null
          vendedor?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          product_id: string | null
          barcode: string
          created_at: string
          custo_medio_apos: number
          entry_id: string
          estoque_apos: number
          id: string
          product_name: string
          quantidade: number
          valor_custo: number
          valor_venda: number
        }
        Insert: {
          product_id?: string | null
          barcode: string
          created_at?: string
          custo_medio_apos?: number
          entry_id: string
          estoque_apos?: number
          id?: string
          product_name?: string
          quantidade?: number
          valor_custo?: number
          valor_venda?: number
        }
        Update: {
          product_id?: string | null
          barcode?: string
          created_at?: string
          custo_medio_apos?: number
          entry_id?: string
          estoque_apos?: number
          id?: string
          product_name?: string
          quantidade?: number
          valor_custo?: number
          valor_venda?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "purchase_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          barcode: string
          cancel_motivo: string | null
          canceled_at: string | null
          client_id: string | null
          client_nome: string
          created_at: string
          desconto: number
          desconto_percentual: number
          forma_pagamento: string
          id: string
          observacoes: string
          order_id: string | null
          pgto_boleto: number
          pgto_cartao: number
          pgto_dinheiro: number
          pgto_outros: number
          pgto_pix: number
          product_name: string
          quantidade: number
          status: Database["public"]["Enums"]["sale_status"]
          total_bruto: number
          total_cost: number
          total_liquido: number
          troco: number
          unit_cost: number
          valor_pago: number
          valor_unitario: number
          vendedor: string
        }
        Insert: {
          barcode?: string
          cancel_motivo?: string | null
          canceled_at?: string | null
          client_id?: string | null
          client_nome?: string
          created_at?: string
          desconto?: number
          desconto_percentual?: number
          forma_pagamento?: string
          id?: string
          observacoes?: string
          order_id?: string | null
          pgto_boleto?: number
          pgto_cartao?: number
          pgto_dinheiro?: number
          pgto_outros?: number
          pgto_pix?: number
          product_name?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["sale_status"]
          total_bruto?: number
          total_cost?: number
          total_liquido?: number
          troco?: number
          unit_cost?: number
          valor_pago?: number
          valor_unitario?: number
          vendedor: string
        }
        Update: {
          barcode?: string
          cancel_motivo?: string | null
          canceled_at?: string | null
          client_id?: string | null
          client_nome?: string
          created_at?: string
          desconto?: number
          desconto_percentual?: number
          forma_pagamento?: string
          id?: string
          observacoes?: string
          order_id?: string | null
          pgto_boleto?: number
          pgto_cartao?: number
          pgto_dinheiro?: number
          pgto_outros?: number
          pgto_pix?: number
          product_name?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["sale_status"]
          total_bruto?: number
          total_cost?: number
          total_liquido?: number
          troco?: number
          unit_cost?: number
          valor_pago?: number
          valor_unitario?: number
          vendedor?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          product_id: string | null
          saldo_anterior: number
          custo_medio_anterior: number
          usuario_id: string | null
          usuario_nome: string
          device_info: string
          barcode: string
          created_at: string
          custo_medio_apos: number
          custo_unitario: number
          estoque_apos: number
          id: string
          movement_type: string
          observacoes: string
          product_name: string
          quantidade: number
          reference_id: string | null
          reference_type: string
        }
        Insert: {
          product_id?: string | null
          saldo_anterior?: number
          custo_medio_anterior?: number
          usuario_id?: string | null
          usuario_nome?: string
          device_info?: string
          barcode: string
          created_at?: string
          custo_medio_apos?: number
          custo_unitario?: number
          estoque_apos?: number
          id?: string
          movement_type: string
          observacoes?: string
          product_name?: string
          quantidade: number
          reference_id?: string | null
          reference_type?: string
        }
        Update: {
          product_id?: string | null
          saldo_anterior?: number
          custo_medio_anterior?: number
          usuario_id?: string | null
          usuario_nome?: string
          device_info?: string
          barcode?: string
          created_at?: string
          custo_medio_apos?: number
          custo_unitario?: number
          estoque_apos?: number
          id?: string
          movement_type?: string
          observacoes?: string
          product_name?: string
          quantidade?: number
          reference_id?: string | null
          reference_type?: string
        }
        Relationships: []
      }
      stock_settings: {
        Row: {
          bloquear_venda_sem_saldo: boolean
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bloquear_venda_sem_saldo?: boolean
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bloquear_venda_sem_saldo?: boolean
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      inventory_counts_summary: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          created_at: string | null
          created_by: string | null
          created_by_nome: string | null
          finalized_at: string | null
          finalized_by: string | null
          finalized_by_nome: string | null
          id: string | null
          itens_contados: number | null
          lancamentos: number | null
          numero: number | null
          observacoes: string | null
          status: Database["public"]["Enums"]["inventory_status"] | null
          tipo: Database["public"]["Enums"]["inventory_type"] | null
          total_divergencias: number | null
          total_itens: number | null
          valor_antes: number | null
          valor_depois: number | null
          valor_divergencia: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _apply_stock_movement: {
        Args: {
          _custo_unit?: number
          _device?: string
          _obs?: string
          _product_id: string
          _qtd: number
          _ref_id?: string
          _ref_type?: string
          _tipo: string
        }
        Returns: {
          barcode: string
          created_at: string
          custo_medio_anterior: number
          custo_medio_apos: number
          custo_unitario: number
          device_info: string
          estoque_apos: number
          id: string
          movement_type: string
          observacoes: string
          product_id: string | null
          product_name: string
          quantidade: number
          reference_id: string | null
          reference_type: string
          saldo_anterior: number
          usuario_id: string | null
          usuario_nome: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _create_stock_product: {
        Args: {
          _barcode: string
          _name: string
          _pendente?: boolean
          _price?: number
        }
        Returns: string
      }
      apply_initial_avg_cost: {
        Args: { _product_ids: string[] }
        Returns: number
      }
      apply_purchase_entry: {
        Args: { _file_name: string; _items: Json; _vendedor: string }
        Returns: string
      }
      cancel_inventory: { Args: { _count_id: string }; Returns: undefined }
      cancel_order: {
        Args: { _motivo: string; _order_id: string }
        Returns: undefined
      }
      create_inventory_count: {
        Args: { _observacoes?: string }
        Returns: string
      }
      create_order: { Args: { _items: Json; _order: Json }; Returns: Json }
      current_user_display_name: { Args: never; Returns: string }
      finalize_inventory: {
        Args: {
          _count_id: string
          _tipo: Database["public"]["Enums"]["inventory_type"]
        }
        Returns: Json
      }
      get_inventory_conference: {
        Args: {
          _count_id: string
          _tipo?: Database["public"]["Enums"]["inventory_type"]
        }
        Returns: {
          a_identificar: boolean
          ajusta: boolean
          barcode: string
          category: string
          contando: boolean
          custo_medio: number
          diferenca: number
          leituras: number
          movimentos_durante: number
          pendente_identificacao: boolean
          product_id: string | null
          product_name: string
          quantidade_contada: number
          quantidade_salva: number | null
          saldo_sistema: number
          salvo: boolean
          saved_at: string | null
          saved_by_nome: string | null
          situacao: string
          ultimo_lancamento: string | null
          valor_diferenca: number
        }[]
      }
      identify_product: {
        Args: {
          _category: string
          _cost: number
          _price: number
          _product_id: string
          _product_name: string
        }
        Returns: undefined
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
      merge_products: {
        Args: { _source_id: string; _target_id: string }
        Returns: undefined
      }
      preview_initial_avg_cost: {
        Args: never
        Returns: {
          barcode: string
          custo_atual: number
          custo_calculado: number
          diferenca: number
          media_simples: number
          product_id: string
          product_name: string
          qtd_comprada: number
          qtd_entradas: number
          saldo_atual: number
        }[]
      }
      register_count_entry: {
        Args: {
          _barcode: string
          _client_created_at?: string
          _count_id: string
          _device_id?: string
          _device_label?: string
          _id: string
          _quantidade: number
          _tipo?: string
        }
        Returns: undefined
      }
      resolve_product: { Args: { _barcode: string }; Returns: string }
      reverse_purchase_entry: { Args: { _entry_id: string }; Returns: undefined }
      save_count_item: {
        Args: { _barcode: string; _count_id: string }
        Returns: Json
      }
      set_inventory_status: {
        Args: {
          _count_id: string
          _status: Database["public"]["Enums"]["inventory_status"]
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      register_sale_movement: {
        Args: {
          _barcode: string
          _product_name: string
          _quantidade: number
          _sale_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "manager"
      inventory_status: "ABERTA" | "EM_CONFERENCIA" | "FINALIZADA" | "CANCELADA"
      inventory_type: "TOTAL" | "PARCIAL"
      payment_method: "PIX" | "CARTAO" | "DINHEIRO" | "BOLETO" | "OUTROS"
      sale_status: "ATIVA" | "CANCELADA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "seller", "manager"],
      inventory_status: ["ABERTA", "EM_CONFERENCIA", "FINALIZADA", "CANCELADA"],
      inventory_type: ["TOTAL", "PARCIAL"],
      payment_method: ["PIX", "CARTAO", "DINHEIRO", "BOLETO", "OUTROS"],
      sale_status: ["ATIVA", "CANCELADA"],
    },
  },
} as const
