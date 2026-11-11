// Generated from the public Supabase schema. Do not edit by hand.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bls_food_nutrients: {
        Row: {
          bls_code: string
          dataset_id: string
          nutrient_code: string
          origin: string | null
          raw_value: string | null
          reference_text: string | null
          value: number | null
          value_kind: string
        }
        Insert: {
          bls_code: string
          dataset_id: string
          nutrient_code: string
          origin?: string | null
          raw_value?: string | null
          reference_text?: string | null
          value?: number | null
          value_kind: string
        }
        Update: {
          bls_code?: string
          dataset_id?: string
          nutrient_code?: string
          origin?: string | null
          raw_value?: string | null
          reference_text?: string | null
          value?: number | null
          value_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "bls_food_nutrients_dataset_id_bls_code_fkey"
            columns: ["dataset_id", "bls_code"]
            isOneToOne: false
            referencedRelation: "bls_foods"
            referencedColumns: ["dataset_id", "bls_code"]
          },
          {
            foreignKeyName: "bls_food_nutrients_dataset_id_nutrient_code_fkey"
            columns: ["dataset_id", "nutrient_code"]
            isOneToOne: false
            referencedRelation: "nutrients"
            referencedColumns: ["dataset_id", "code"]
          },
        ]
      }
      bls_foods: {
        Row: {
          bls_code: string
          dataset_id: string
          name_de: string
          name_en: string
          notes: string | null
          source_row: number
        }
        Insert: {
          bls_code: string
          dataset_id: string
          name_de: string
          name_en: string
          notes?: string | null
          source_row: number
        }
        Update: {
          bls_code?: string
          dataset_id?: string
          name_de?: string
          name_en?: string
          notes?: string | null
          source_row?: number
        }
        Relationships: [
          {
            foreignKeyName: "bls_foods_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "nutrition_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_import_details: {
        Row: {
          accounting_group_name: string | null
          accounting_group_source_id: string | null
          created_at: string
          currency: string
          dish_id: string
          prices: Json
          restaurant_id: string
          selected_price_index: number
          sku: string
        }
        Insert: {
          accounting_group_name?: string | null
          accounting_group_source_id?: string | null
          created_at?: string
          currency?: string
          dish_id: string
          prices: Json
          restaurant_id: string
          selected_price_index: number
          sku: string
        }
        Update: {
          accounting_group_name?: string | null
          accounting_group_source_id?: string | null
          created_at?: string
          currency?: string
          dish_id?: string
          prices?: Json
          restaurant_id?: string
          selected_price_index?: number
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_import_details_own_dish"
            columns: ["restaurant_id", "dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      dish_ingredients: {
        Row: {
          dish_id: string
          ingredient_id: string
          quantity_g: number
          restaurant_id: string
        }
        Insert: {
          dish_id: string
          ingredient_id: string
          quantity_g: number
          restaurant_id: string
        }
        Update: {
          dish_id?: string
          ingredient_id?: string
          quantity_g?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_ingredients_own_dish"
            columns: ["restaurant_id", "dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "dish_ingredients_own_ingredient"
            columns: ["restaurant_id", "ingredient_id"]
            isOneToOne: false
            referencedRelation: "restaurant_ingredients"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      dishes: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          servings: number
          source: string | null
          source_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          servings?: number
          source?: string | null
          source_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          servings?: number
          source?: string | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrients: {
        Row: {
          code: string
          dataset_id: string
          formula: string | null
          formula_application: string | null
          group_de: string
          group_en: string
          name_de: string
          name_en: string
          sort_index: number
          unit: string
        }
        Insert: {
          code: string
          dataset_id: string
          formula?: string | null
          formula_application?: string | null
          group_de: string
          group_en: string
          name_de: string
          name_en: string
          sort_index: number
          unit: string
        }
        Update: {
          code?: string
          dataset_id?: string
          formula?: string | null
          formula_application?: string | null
          group_de?: string
          group_en?: string
          name_de?: string
          name_en?: string
          sort_index?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrients_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "nutrition_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_datasets: {
        Row: {
          basis_quantity: number
          basis_unit: string
          content_sha256: string
          file_manifest: Json
          food_count: number
          id: string
          imported_at: string
          is_active: boolean
          nutrient_count: number
          release_year: number
          source: string
          source_url: string
          source_version: string
        }
        Insert: {
          basis_quantity?: number
          basis_unit?: string
          content_sha256: string
          file_manifest: Json
          food_count: number
          id?: string
          imported_at?: string
          is_active?: boolean
          nutrient_count: number
          release_year: number
          source: string
          source_url: string
          source_version: string
        }
        Update: {
          basis_quantity?: number
          basis_unit?: string
          content_sha256?: string
          file_manifest?: Json
          food_count?: number
          id?: string
          imported_at?: string
          is_active?: boolean
          nutrient_count?: number
          release_year?: number
          source?: string
          source_url?: string
          source_version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      restaurant_ingredients: {
        Row: {
          bls_code: string
          created_at: string
          dataset_id: string
          id: string
          name: string
          restaurant_id: string
        }
        Insert: {
          bls_code: string
          created_at?: string
          dataset_id: string
          id?: string
          name: string
          restaurant_id: string
        }
        Update: {
          bls_code?: string
          created_at?: string
          dataset_id?: string
          id?: string
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ingredients_bls_food"
            columns: ["dataset_id", "bls_code"]
            isOneToOne: false
            referencedRelation: "bls_foods"
            referencedColumns: ["dataset_id", "bls_code"]
          },
          {
            foreignKeyName: "restaurant_ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          created_at: string
          restaurant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_restaurant_registration: { Args: never; Returns: string }
      create_restaurant: { Args: { restaurant_name: string }; Returns: string }
      get_dish_nutrition: {
        Args: { target_dish_id: string }
        Returns: {
          ingredient_count: number
          issues: Json
          known_ingredient_count: number
          nutrient_code: string
          per_serving: number
          recipe_total: number
          status: string
          unit: string
        }[]
      }
      import_lightspeed_items: {
        Args: { imported_items: Json; target_restaurant_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
