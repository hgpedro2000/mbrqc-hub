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
      alertas: {
        Row: {
          created_at: string
          criado_por_id: string | null
          data_ocorrencia: string | null
          data_validade: string | null
          descricao: string | null
          emitido_por: string | null
          foto_ng_url: string | null
          foto_ok_url: string | null
          id: string
          linha_peca: string | null
          local_detectado: string | null
          modelo: string | null
          modo_falha: string | null
          observacoes: string | null
          responsabilidade: string | null
          sequencia_bp: string | null
          sequencial: number
          status: string
          total_destinatarios: number | null
          turno: string | null
          vin: string | null
          vin_bp: string | null
        }
        Insert: {
          created_at?: string
          criado_por_id?: string | null
          data_ocorrencia?: string | null
          data_validade?: string | null
          descricao?: string | null
          emitido_por?: string | null
          foto_ng_url?: string | null
          foto_ok_url?: string | null
          id?: string
          linha_peca?: string | null
          local_detectado?: string | null
          modelo?: string | null
          modo_falha?: string | null
          observacoes?: string | null
          responsabilidade?: string | null
          sequencia_bp?: string | null
          sequencial?: never
          status?: string
          total_destinatarios?: number | null
          turno?: string | null
          vin?: string | null
          vin_bp?: string | null
        }
        Update: {
          created_at?: string
          criado_por_id?: string | null
          data_ocorrencia?: string | null
          data_validade?: string | null
          descricao?: string | null
          emitido_por?: string | null
          foto_ng_url?: string | null
          foto_ok_url?: string | null
          id?: string
          linha_peca?: string | null
          local_detectado?: string | null
          modelo?: string | null
          modo_falha?: string | null
          observacoes?: string | null
          responsabilidade?: string | null
          sequencia_bp?: string | null
          sequencial?: never
          status?: string
          total_destinatarios?: number | null
          turno?: string | null
          vin?: string | null
          vin_bp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_criado_por_id_fkey"
            columns: ["criado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_criado_por_id_fkey"
            columns: ["criado_por_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      apontamento_history: {
        Row: {
          apontamento_id: string
          changes: Json
          edited_at: string
          edited_by: string | null
          edited_by_email: string | null
          edited_by_name: string | null
          id: string
          is_admin_edit: boolean
        }
        Insert: {
          apontamento_id: string
          changes?: Json
          edited_at?: string
          edited_by?: string | null
          edited_by_email?: string | null
          edited_by_name?: string | null
          id?: string
          is_admin_edit?: boolean
        }
        Update: {
          apontamento_id?: string
          changes?: Json
          edited_at?: string
          edited_by?: string | null
          edited_by_email?: string | null
          edited_by_name?: string | null
          id?: string
          is_admin_edit?: boolean
        }
        Relationships: []
      }
      apontamentos: {
        Row: {
          acao_corretiva: string | null
          acao_imediata: string | null
          alc_code: string | null
          alc_expected: string | null
          alc_validation_method: string | null
          alc_validation_status: string | null
          analise_inicial: string | null
          causa_raiz: string | null
          co_inspetores: Json | null
          comentario_adicional: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          fase: string | null
          fornecedor: string | null
          id: string
          lancamento: string | null
          last_edited_at: string | null
          last_edited_by: string | null
          linha: string | null
          local_deteccao: string | null
          lote_inspecionado: string | null
          modo_falha: string | null
          numero: string | null
          numero_tag: string | null
          observacoes: string | null
          parada_linha: string | null
          parada_linha_tempo: string | null
          part_name: string | null
          part_number: string | null
          prazo: string | null
          projeto: string | null
          quantidade: number | null
          quantidade_detectado: number | null
          quantidade_inspecionada: number | null
          quantidade_ng: number | null
          quantidade_ok: number | null
          responsabilidade_defeito: string | null
          responsavel: string
          responsavel_acao: string | null
          segundo_defeitos: Json | null
          setor: string | null
          severidade: string | null
          status: string
          tag_inserted_at: string | null
          tag_inserted_by: string | null
          tag_number: string | null
          tempo_inspecao: string | null
          tipo: string
          titulo: string
          turno: string | null
          updated_at: string
          vin_number: string | null
        }
        Insert: {
          acao_corretiva?: string | null
          acao_imediata?: string | null
          alc_code?: string | null
          alc_expected?: string | null
          alc_validation_method?: string | null
          alc_validation_status?: string | null
          analise_inicial?: string | null
          causa_raiz?: string | null
          co_inspetores?: Json | null
          comentario_adicional?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          descricao: string
          fase?: string | null
          fornecedor?: string | null
          id?: string
          lancamento?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          linha?: string | null
          local_deteccao?: string | null
          lote_inspecionado?: string | null
          modo_falha?: string | null
          numero?: string | null
          numero_tag?: string | null
          observacoes?: string | null
          parada_linha?: string | null
          parada_linha_tempo?: string | null
          part_name?: string | null
          part_number?: string | null
          prazo?: string | null
          projeto?: string | null
          quantidade?: number | null
          quantidade_detectado?: number | null
          quantidade_inspecionada?: number | null
          quantidade_ng?: number | null
          quantidade_ok?: number | null
          responsabilidade_defeito?: string | null
          responsavel: string
          responsavel_acao?: string | null
          segundo_defeitos?: Json | null
          setor?: string | null
          severidade?: string | null
          status?: string
          tag_inserted_at?: string | null
          tag_inserted_by?: string | null
          tag_number?: string | null
          tempo_inspecao?: string | null
          tipo: string
          titulo: string
          turno?: string | null
          updated_at?: string
          vin_number?: string | null
        }
        Update: {
          acao_corretiva?: string | null
          acao_imediata?: string | null
          alc_code?: string | null
          alc_expected?: string | null
          alc_validation_method?: string | null
          alc_validation_status?: string | null
          analise_inicial?: string | null
          causa_raiz?: string | null
          co_inspetores?: Json | null
          comentario_adicional?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          fase?: string | null
          fornecedor?: string | null
          id?: string
          lancamento?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          linha?: string | null
          local_deteccao?: string | null
          lote_inspecionado?: string | null
          modo_falha?: string | null
          numero?: string | null
          numero_tag?: string | null
          observacoes?: string | null
          parada_linha?: string | null
          parada_linha_tempo?: string | null
          part_name?: string | null
          part_number?: string | null
          prazo?: string | null
          projeto?: string | null
          quantidade?: number | null
          quantidade_detectado?: number | null
          quantidade_inspecionada?: number | null
          quantidade_ng?: number | null
          quantidade_ok?: number | null
          responsabilidade_defeito?: string | null
          responsavel?: string
          responsavel_acao?: string | null
          segundo_defeitos?: Json | null
          setor?: string | null
          severidade?: string | null
          status?: string
          tag_inserted_at?: string | null
          tag_inserted_by?: string | null
          tag_number?: string | null
          tempo_inspecao?: string | null
          tipo?: string
          titulo?: string
          turno?: string | null
          updated_at?: string
          vin_number?: string | null
        }
        Relationships: []
      }
      app_changelog: {
        Row: {
          change_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          released_at: string
          title: string
          version: string
        }
        Insert: {
          change_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          released_at?: string
          title: string
          version: string
        }
        Update: {
          change_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          released_at?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
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
          fornecedor: string | null
          id: string
          items: Json
          modulo: string | null
          nome: string
          numero: string | null
          part_name: string | null
          part_number: string | null
          projeto: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checked_items?: Json
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          fornecedor?: string | null
          id?: string
          items?: Json
          modulo?: string | null
          nome: string
          numero?: string | null
          part_name?: string | null
          part_number?: string | null
          projeto?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checked_items?: Json
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          fornecedor?: string | null
          id?: string
          items?: Json
          modulo?: string | null
          nome?: string
          numero?: string | null
          part_name?: string | null
          part_number?: string | null
          projeto?: string | null
          status?: string
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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          module: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module?: string
          user_email?: string | null
          user_id?: string | null
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
      capsule_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          uploaded_by: string
          uploaded_by_name: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          uploaded_by: string
          uploaded_by_name?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          uploaded_by?: string
          uploaded_by_name?: string
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
      ciencias: {
        Row: {
          alerta_id: string
          created_at: string
          id: string
          inspetor_id: string
          metodo: string
          registrado_por_id: string | null
          termo_aceito: string | null
          versao_termo: string | null
        }
        Insert: {
          alerta_id: string
          created_at?: string
          id?: string
          inspetor_id: string
          metodo?: string
          registrado_por_id?: string | null
          termo_aceito?: string | null
          versao_termo?: string | null
        }
        Update: {
          alerta_id?: string
          created_at?: string
          id?: string
          inspetor_id?: string
          metodo?: string
          registrado_por_id?: string | null
          termo_aceito?: string | null
          versao_termo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ciencias_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciencias_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciencias_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciencias_registrado_por_id_fkey"
            columns: ["registrado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciencias_registrado_por_id_fkey"
            columns: ["registrado_por_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumable_items: {
        Row: {
          active: boolean
          created_at: string
          id: string
          min_qty: number
          name: string
          stock_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          min_qty?: number
          name: string
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          min_qty?: number
          name?: string
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      consumable_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          item_id: string
          item_name: string
          numero: string | null
          quantity: number
          status: string
          turno: string | null
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          item_id: string
          item_name?: string
          numero?: string | null
          quantity?: number
          status?: string
          turno?: string | null
          updated_at?: string
          user_id: string
          user_name?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          numero?: string | null
          quantity?: number
          status?: string
          turno?: string | null
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumable_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "consumable_items"
            referencedColumns: ["id"]
          },
        ]
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
      email_automation_config: {
        Row: {
          cc_recipients: string[]
          created_at: string
          enabled: boolean
          id: string
          include_dashboard_html: boolean
          include_ng_pdf: boolean
          last_sent_at: string | null
          message_body: string
          name: string
          recipients: string[]
          schedule_time: string
          subject_template: string
          timezone: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          cc_recipients?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          include_dashboard_html?: boolean
          include_ng_pdf?: boolean
          last_sent_at?: string | null
          message_body?: string
          name?: string
          recipients?: string[]
          schedule_time?: string
          subject_template?: string
          timezone?: string
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          cc_recipients?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          include_dashboard_html?: boolean
          include_ng_pdf?: boolean
          last_sent_at?: string | null
          message_body?: string
          name?: string
          recipients?: string[]
          schedule_time?: string
          subject_template?: string
          timezone?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      email_automation_log: {
        Row: {
          config_id: string | null
          created_at: string
          error_message: string | null
          id: string
          ng_count: number | null
          recipients: string[]
          status: string
          subject: string | null
          trigger_type: string
          triggered_by: string | null
        }
        Insert: {
          config_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ng_count?: number | null
          recipients?: string[]
          status?: string
          subject?: string | null
          trigger_type?: string
          triggered_by?: string | null
        }
        Update: {
          config_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ng_count?: number | null
          recipients?: string[]
          status?: string
          subject?: string | null
          trigger_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_log_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "email_automation_config"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresas_terceiras: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          module: string
          numero: string | null
          photos: Json | null
          status: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          module?: string
          numero?: string | null
          photos?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          user_name?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          module?: string
          numero?: string | null
          photos?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          user_name?: string
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
          status: string
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
          status?: string
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
          status?: string
          tonelagem?: number
          total_pecas?: number | null
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      inspector_qualifications: {
        Row: {
          area: string
          created_at: string
          habilitado: boolean
          id: string
          last_evaluation_date: string | null
          next_evaluation_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          habilitado?: boolean
          id?: string
          last_evaluation_date?: string | null
          next_evaluation_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          habilitado?: boolean
          id?: string
          last_evaluation_date?: string | null
          next_evaluation_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      matriz_attachments: {
        Row: {
          area: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          uploaded_by: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          uploaded_by: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          uploaded_by?: string
          user_id?: string
        }
        Relationships: []
      }
      matriz_editors: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          user_id?: string
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
          fornecedor: string | null
          id: string
          items: Json
          modulo: string | null
          nome: string
          numero: string | null
          part_name: string | null
          part_number: string | null
          projeto: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checked_items?: Json
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          fornecedor?: string | null
          id?: string
          items?: Json
          modulo?: string | null
          nome: string
          numero?: string | null
          part_name?: string | null
          part_number?: string | null
          projeto?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checked_items?: Json
          comentarios?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          fornecedor?: string | null
          id?: string
          items?: Json
          modulo?: string | null
          nome?: string
          numero?: string | null
          part_name?: string | null
          part_number?: string | null
          projeto?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      part_numbers: {
        Row: {
          active: boolean
          alc_code: string
          created_at: string
          id: string
          line_module: string
          origem: string | null
          part_name: string
          part_number: string
          project: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          alc_code?: string
          created_at?: string
          id?: string
          line_module?: string
          origem?: string | null
          part_name: string
          part_number: string
          project?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          alc_code?: string
          created_at?: string
          id?: string
          line_module?: string
          origem?: string | null
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
      password_history: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          employee_number: string
          empresa: string | null
          empresa_terceira: string | null
          full_name: string
          id: string
          is_admin: boolean
          last_login_at: string | null
          must_change_password: boolean
          password_changed_at: string | null
          qr_code_id: string | null
          status: string
          turno: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          employee_number: string
          empresa?: string | null
          empresa_terceira?: string | null
          full_name: string
          id: string
          is_admin?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          password_changed_at?: string | null
          qr_code_id?: string | null
          status?: string
          turno?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          employee_number?: string
          empresa?: string | null
          empresa_terceira?: string | null
          full_name?: string
          id?: string
          is_admin?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          password_changed_at?: string | null
          qr_code_id?: string | null
          status?: string
          turno?: string | null
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
      stock_history: {
        Row: {
          created_at: string
          created_by_name: string
          id: string
          item_id: string
          new_qty: number
          notes: string | null
          previous_qty: number
          quantity: number
          type: string
        }
        Insert: {
          created_at?: string
          created_by_name?: string
          id?: string
          item_id: string
          new_qty?: number
          notes?: string | null
          previous_qty?: number
          quantity?: number
          type?: string
        }
        Update: {
          created_at?: string
          created_by_name?: string
          id?: string
          item_id?: string
          new_qty?: number
          notes?: string | null
          previous_qty?: number
          quantity?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "consumable_items"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          origem: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          origem?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          origem?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      training_history: {
        Row: {
          area: string
          created_at: string
          created_by: string | null
          id: string
          next_training_date: string
          notes: string | null
          training_date: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          created_by?: string | null
          id?: string
          next_training_date: string
          notes?: string | null
          training_date: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string | null
          id?: string
          next_training_date?: string
          notes?: string | null
          training_date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_module_order: {
        Row: {
          id: string
          module_order: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          module_order?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          module_order?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          user_id?: string
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
      public_profiles: {
        Row: {
          cargo: string | null
          employee_number: string | null
          empresa: string | null
          empresa_terceira: string | null
          full_name: string | null
          id: string | null
          qr_code_id: string | null
          status: string | null
          turno: string | null
        }
        Insert: {
          cargo?: string | null
          employee_number?: string | null
          empresa?: string | null
          empresa_terceira?: string | null
          full_name?: string | null
          id?: string | null
          qr_code_id?: string | null
          status?: string | null
          turno?: string | null
        }
        Update: {
          cargo?: string | null
          employee_number?: string | null
          empresa?: string | null
          empresa_terceira?: string | null
          full_name?: string | null
          id?: string | null
          qr_code_id?: string | null
          status?: string | null
          turno?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      clear_must_change_password: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_co_inspection_profiles: {
        Args: never
        Returns: {
          empresa: string
          full_name: string
          id: string
          turno: string
        }[]
      }
      get_creator_empresa_map: {
        Args: never
        Returns: {
          empresa: string
          empresa_terceira: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_part_number: { Args: { _pn: string }; Returns: string }
      profile_update_is_safe: {
        Args: { _new: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "engenharia" | "lider" | "inspetor"
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
      app_role: ["admin", "user", "engenharia", "lider", "inspetor"],
    },
  },
} as const
