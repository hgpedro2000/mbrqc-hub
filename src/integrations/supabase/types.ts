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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alertas_qualidade: {
        Row: {
          acao_corretiva: string | null
          acao_imediata: string | null
          created_at: string
          data_emissao: string
          data_validade: string | null
          descricao_problema: string
          emitente: string
          fornecedor: string | null
          id: string
          linha: string | null
          numero_alerta: string
          observacoes: string | null
          part_name: string | null
          part_number: string | null
          responsavel: string | null
          setor: string | null
          severidade: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_corretiva?: string | null
          acao_imediata?: string | null
          created_at?: string
          data_emissao: string
          data_validade?: string | null
          descricao_problema: string
          emitente: string
          fornecedor?: string | null
          id?: string
          linha?: string | null
          numero_alerta: string
          observacoes?: string | null
          part_name?: string | null
          part_number?: string | null
          responsavel?: string | null
          setor?: string | null
          severidade?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_corretiva?: string | null
          acao_imediata?: string | null
          created_at?: string
          data_emissao?: string
          data_validade?: string | null
          descricao_problema?: string
          emitente?: string
          fornecedor?: string | null
          id?: string
          linha?: string | null
          numero_alerta?: string
          observacoes?: string | null
          part_name?: string | null
          part_number?: string | null
          responsavel?: string | null
          setor?: string | null
          severidade?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      apontamentos: {
        Row: {
          acao_corretiva: string | null
          causa_raiz: string | null
          created_at: string
          data: string
          descricao: string
          id: string
          linha: string | null
          numero: string | null
          observacoes: string | null
          part_name: string | null
          part_number: string | null
          prazo: string | null
          quantidade: number | null
          responsavel: string
          responsavel_acao: string | null
          setor: string | null
          severidade: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_corretiva?: string | null
          causa_raiz?: string | null
          created_at?: string
          data: string
          descricao: string
          id?: string
          linha?: string | null
          numero?: string | null
          observacoes?: string | null
          part_name?: string | null
          part_number?: string | null
          prazo?: string | null
          quantidade?: number | null
          responsavel: string
          responsavel_acao?: string | null
          setor?: string | null
          severidade?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_corretiva?: string | null
          causa_raiz?: string | null
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          linha?: string | null
          numero?: string | null
          observacoes?: string | null
          part_name?: string | null
          part_number?: string | null
          prazo?: string | null
          quantidade?: number | null
          responsavel?: string
          responsavel_acao?: string | null
          setor?: string | null
          severidade?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      assembly_checklists: {
        Row: {
          checked_items: Json
          comentarios: string | null
          created_at: string
          created_by: string | null
          data: string
          id: string
          items: Json
          nome: string
          numero: string | null
          updated_at: string
        }
        Insert: {
          checked_items?: Json
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          items?: Json
          nome: string
          numero?: string | null
          updated_at?: string
        }
        Update: {
          checked_items?: Json
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          items?: Json
          nome?: string
          numero?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_items: {
        Row: {
          active: boolean | null
          audit_type: string
          category: string
          created_at: string
          description: string
          id: string
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          audit_type: string
          category: string
          created_at?: string
          description: string
          id?: string
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          audit_type?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      audit_responses: {
        Row: {
          audit_item_id: string
          auditoria_id: string
          conformidade: string | null
          created_at: string
          id: string
          observacao: string | null
          score: number | null
        }
        Insert: {
          audit_item_id: string
          auditoria_id: string
          conformidade?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          score?: number | null
        }
        Update: {
          audit_item_id?: string
          auditoria_id?: string
          conformidade?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_responses_audit_item_id_fkey"
            columns: ["audit_item_id"]
            isOneToOne: false
            referencedRelation: "audit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_responses_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
        ]
      }
      auditorias: {
        Row: {
          auditor: string
          created_at: string
          data: string
          fornecedor: string | null
          id: string
          linha: string | null
          numero: string | null
          observacoes: string | null
          pontuacao_obtida: number | null
          pontuacao_total: number | null
          setor: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          auditor: string
          created_at?: string
          data: string
          fornecedor?: string | null
          id?: string
          linha?: string | null
          numero?: string | null
          observacoes?: string | null
          pontuacao_obtida?: number | null
          pontuacao_total?: number | null
          setor?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          auditor?: string
          created_at?: string
          data?: string
          fornecedor?: string | null
          id?: string
          linha?: string | null
          numero?: string | null
          observacoes?: string | null
          pontuacao_obtida?: number | null
          pontuacao_total?: number | null
          setor?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklist_photos: {
        Row: {
          checklist_id: string
          checklist_type: string
          created_at: string
          file_name: string
          file_path: string
          id: string
        }
        Insert: {
          checklist_id: string
          checklist_type: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
        }
        Update: {
          checklist_id?: string
          checklist_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
        }
        Relationships: []
      }
      contencao: {
        Row: {
          acao_contencao: string | null
          created_at: string
          data: string
          fornecedor: string | null
          id: string
          linha: string | null
          motivo: string | null
          numero: string | null
          observacoes: string | null
          part_name: string | null
          part_number: string | null
          quantidade_aprovada: number | null
          quantidade_contida: number | null
          quantidade_rejeitada: number | null
          responsavel: string
          setor: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_contencao?: string | null
          created_at?: string
          data: string
          fornecedor?: string | null
          id?: string
          linha?: string | null
          motivo?: string | null
          numero?: string | null
          observacoes?: string | null
          part_name?: string | null
          part_number?: string | null
          quantidade_aprovada?: number | null
          quantidade_contida?: number | null
          quantidade_rejeitada?: number | null
          responsavel: string
          setor?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_contencao?: string | null
          created_at?: string
          data?: string
          fornecedor?: string | null
          id?: string
          linha?: string | null
          motivo?: string | null
          numero?: string | null
          observacoes?: string | null
          part_name?: string | null
          part_number?: string | null
          quantidade_aprovada?: number | null
          quantidade_contida?: number | null
          quantidade_rejeitada?: number | null
          responsavel?: string
          setor?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      defect_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      defects: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dropdown_options: {
        Row: {
          active: boolean | null
          category: string
          created_at: string
          id: string
          label: string
          sort_order: number | null
          value: string
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number | null
          value: string
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number | null
          value?: string
        }
        Relationships: []
      }
      injection_checklists: {
        Row: {
          comentarios: string | null
          cooling_time: number
          created_at: string
          created_by: string | null
          cycle_time: number
          data: string
          defects: Json | null
          dimensional: string
          fornecedor: string
          id: string
          improvement_category: number | null
          injetora: string
          materia_prima: string
          modulo: string
          needs_improvement: boolean
          nome: string
          numero: string | null
          part_name: string
          part_number: string
          pecas_ng: number | null
          pecas_ok: number | null
          projeto: string
          qtd_tryout: number
          rate: number | null
          razao_tryout: string | null
          razao_tryout_outro: string | null
          tonelagem: number
          total_pecas: number | null
          updated_at: string
          weight: number
        }
        Insert: {
          comentarios?: string | null
          cooling_time: number
          created_at?: string
          created_by?: string | null
          cycle_time: number
          data: string
          defects?: Json | null
          dimensional: string
          fornecedor: string
          id?: string
          improvement_category?: number | null
          injetora: string
          materia_prima: string
          modulo: string
          needs_improvement?: boolean
          nome: string
          numero?: string | null
          part_name: string
          part_number: string
          pecas_ng?: number | null
          pecas_ok?: number | null
          projeto: string
          qtd_tryout: number
          rate?: number | null
          razao_tryout?: string | null
          razao_tryout_outro?: string | null
          tonelagem: number
          total_pecas?: number | null
          updated_at?: string
          weight: number
        }
        Update: {
          comentarios?: string | null
          cooling_time?: number
          created_at?: string
          created_by?: string | null
          cycle_time?: number
          data?: string
          defects?: Json | null
          dimensional?: string
          fornecedor?: string
          id?: string
          improvement_category?: number | null
          injetora?: string
          materia_prima?: string
          modulo?: string
          needs_improvement?: boolean
          nome?: string
          numero?: string | null
          part_name?: string
          part_number?: string
          pecas_ng?: number | null
          pecas_ok?: number | null
          projeto?: string
          qtd_tryout?: number
          rate?: number | null
          razao_tryout?: string | null
          razao_tryout_outro?: string | null
          tonelagem?: number
          total_pecas?: number | null
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      painting_checklists: {
        Row: {
          checked_items: Json
          comentarios: string | null
          created_at: string
          created_by: string | null
          data: string
          id: string
          items: Json
          nome: string
          numero: string | null
          updated_at: string
        }
        Insert: {
          checked_items?: Json
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          items?: Json
          nome: string
          numero?: string | null
          updated_at?: string
        }
        Update: {
          checked_items?: Json
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          items?: Json
          nome?: string
          numero?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      part_numbers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          line_module: string
          part_name: string
          part_number: string
          project: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          line_module?: string
          part_name: string
          part_number: string
          project?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          line_module?: string
          part_name?: string
          part_number?: string
          project?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_numbers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          employee_number: string
          full_name: string
          id: string
          last_login_at: string | null
          must_change_password: boolean
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employee_number: string
          full_name: string
          id: string
          last_login_at?: string | null
          must_change_password?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employee_number?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          must_change_password?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      responsibilities: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "admin" | "user" | "engenharia"
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
      app_role: ["admin", "user", "engenharia"],
    },
  },
} as const
