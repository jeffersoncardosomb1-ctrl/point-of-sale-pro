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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      orders: {
        Row: {
          cancel_motivo: string | null
          canceled_at: string | null
          created_at: string
          forma_pagamento: Database["public"]["Enums"]["payment_method"]
          id: string
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
          created_at?: string
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
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
          created_at?: string
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
          status?: Database["public"]["Enums"]["sale_status"]
          total_bruto?: number
          total_desconto?: number
          total_liquido?: number
          troco?: number
          updated_at?: string
          valor_pago?: number
          vendedor?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          barcode: string
          product_name: string
          created_at: string
        }
        Insert: {
          id?: string
          barcode: string
          product_name: string
          created_at?: string
        }
        Update: {
          id?: string
          barcode?: string
          product_name?: string
          created_at?: string
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
      sales: {
        Row: {
          barcode: string
          cancel_motivo: string | null
          canceled_at: string | null
          created_at: string
          desconto: number
          desconto_percentual: number
          forma_pagamento: Database["public"]["Enums"]["payment_method"]
          id: string
          order_id: string | null
          product_name: string
          quantidade: number
          status: Database["public"]["Enums"]["sale_status"]
          total_bruto: number
          total_liquido: number
          troco: number
          valor_pago: number
          valor_unitario: number
          vendedor: string
        }
        Insert: {
          barcode?: string
          cancel_motivo?: string | null
          canceled_at?: string | null
          created_at?: string
          desconto?: number
          desconto_percentual?: number
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
          order_id?: string | null
          product_name?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["sale_status"]
          total_bruto?: number
          total_liquido?: number
          troco?: number
          valor_pago?: number
          valor_unitario?: number
          vendedor: string
        }
        Update: {
          barcode?: string
          cancel_motivo?: string | null
          canceled_at?: string | null
          created_at?: string
          desconto?: number
          desconto_percentual?: number
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
          order_id?: string | null
          product_name?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["sale_status"]
          total_bruto?: number
          total_liquido?: number
          troco?: number
          valor_pago?: number
          valor_unitario?: number
          vendedor?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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