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
          barcode: string
          cost_avg: number
          created_at: string | null
          id: string
          price: number
          product_name: string
          stock: number
        }
        Insert: {
          barcode: string
          cost_avg?: number
          created_at?: string | null
          id?: string
          price?: number
          product_name: string
          stock?: number
        }
        Update: {
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
      [_ in never]: never
    }
    Functions: {
      apply_purchase_entry: {
        Args: { _file_name: string; _items: Json; _vendedor: string }
        Returns: string
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
      app_role: "admin" | "seller"
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
      app_role: ["admin", "seller"],
      payment_method: ["PIX", "CARTAO", "DINHEIRO", "BOLETO", "OUTROS"],
      sale_status: ["ATIVA", "CANCELADA"],
    },
  },
} as const
