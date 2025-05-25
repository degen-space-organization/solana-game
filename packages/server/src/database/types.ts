export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string | null
          id: number
          lobby_id: number | null
          match_id: number | null
          message: string
          tournament_id: number | null
          user_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          lobby_id?: number | null
          match_id?: number | null
          message: string
          tournament_id?: number | null
          user_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          lobby_id?: number | null
          match_id?: number | null
          message?: string
          tournament_id?: number | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_lobby_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_match_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tournament_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: number
          match_id: number
          player1_move: string | null
          player2_move: string | null
          round_number: number
          winner_id: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: number
          match_id: number
          player1_move?: string | null
          player2_move?: string | null
          round_number: number
          winner_id?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: number
          match_id?: number
          player1_move?: string | null
          player2_move?: string | null
          round_number?: number
          winner_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_rounds_match_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_rounds_winner_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lobbies: {
        Row: {
          created_at: string | null
          created_by: number
          current_players: number | null
          disbanded_at: string | null
          id: number
          max_players: number | null
          name: string | null
          stake_amount: string
          status: string | null
          tournament_id: number | null
        }
        Insert: {
          created_at?: string | null
          created_by: number
          current_players?: number | null
          disbanded_at?: string | null
          id?: number
          max_players?: number | null
          name?: string | null
          stake_amount: string
          status?: string | null
          tournament_id?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: number
          current_players?: number | null
          disbanded_at?: string | null
          id?: number
          max_players?: number | null
          name?: string | null
          stake_amount?: string
          status?: string | null
          tournament_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lobbies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobbies_tournament_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      lobby_participants: {
        Row: {
          has_staked: boolean | null
          id: number
          is_ready: boolean | null
          joined_at: string | null
          lobby_id: number
          stake_transaction_hash: string | null
          staked_at: string | null
          user_id: number
        }
        Insert: {
          has_staked?: boolean | null
          id?: number
          is_ready?: boolean | null
          joined_at?: string | null
          lobby_id: number
          stake_transaction_hash?: string | null
          staked_at?: string | null
          user_id: number
        }
        Update: {
          has_staked?: boolean | null
          id?: number
          is_ready?: boolean | null
          joined_at?: string | null
          lobby_id?: number
          stake_transaction_hash?: string | null
          staked_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "lobby_participants_lobby_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_participants_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          id: number
          match_id: number
          position: number
          user_id: number
        }
        Insert: {
          id?: number
          match_id: number
          position: number
          user_id: number
        }
        Update: {
          id?: number
          match_id?: number
          position?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: number
          lobby_id: number | null
          prize_distributed: boolean | null
          stake_amount: string
          started_at: string | null
          status: string | null
          total_prize_pool: string
          tournament_id: number | null
          tournament_round: number | null
          winner_id: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: number
          lobby_id?: number | null
          prize_distributed?: boolean | null
          stake_amount: string
          started_at?: string | null
          status?: string | null
          total_prize_pool: string
          tournament_id?: number | null
          tournament_round?: number | null
          winner_id?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: number
          lobby_id?: number | null
          prize_distributed?: boolean | null
          stake_amount?: string
          started_at?: string | null
          status?: string | null
          total_prize_pool?: string
          tournament_id?: number | null
          tournament_round?: number | null
          winner_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_lobby_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stake_transactions: {
        Row: {
          amount: string
          confirmed_at: string | null
          created_at: string | null
          id: number
          lobby_id: number
          match_id: number | null
          status: string | null
          transaction_hash: string
          transaction_type: string
          user_id: number
        }
        Insert: {
          amount: string
          confirmed_at?: string | null
          created_at?: string | null
          id?: number
          lobby_id: number
          match_id?: number | null
          status?: string | null
          transaction_hash: string
          transaction_type: string
          user_id: number
        }
        Update: {
          amount?: string
          confirmed_at?: string | null
          created_at?: string | null
          id?: number
          lobby_id?: number
          match_id?: number | null
          status?: string | null
          transaction_hash?: string
          transaction_type?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stake_transactions_lobby_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stake_transactions_match_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stake_transactions_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          eliminated_at: string | null
          final_position: number | null
          id: number
          joined_at: string | null
          tournament_id: number
          user_id: number
        }
        Insert: {
          eliminated_at?: string | null
          final_position?: number | null
          id?: number
          joined_at?: string | null
          tournament_id: number
          user_id: number
        }
        Update: {
          eliminated_at?: string | null
          final_position?: number | null
          id?: number
          joined_at?: string | null
          tournament_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_players: number | null
          id: number
          max_players: number | null
          name: string
          prize_pool: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_players?: number | null
          id?: number
          max_players?: number | null
          name: string
          prize_pool?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_players?: number | null
          id?: number
          max_players?: number | null
          name?: string
          prize_pool?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          id: number
          matches_lost: number | null
          matches_won: number | null
          nickname: string | null
          solana_address: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          matches_lost?: number | null
          matches_won?: number | null
          nickname?: string | null
          solana_address: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          matches_lost?: number | null
          matches_won?: number | null
          nickname?: string | null
          solana_address?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

