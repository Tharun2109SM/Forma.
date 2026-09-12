export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AnalysisStatus =
  | "DRAFT"
  | "UPLOADING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type DocumentType = "JOB_DESCRIPTION" | "RESUME";
export type DocumentFileExtension = "pdf" | "docx" | "xml" | "txt";

export type DocumentStatus =
  | "QUEUED"
  | "UPLOADING"
  | "UPLOADED"
  | "EXTRACTING"
  | "OCR"
  | "NORMALIZING"
  | "INDEXING"
  | "READY"
  | "FAILED";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      analyses: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          job_title: string | null;
          company_name: string | null;
          jd_object_key: string | null;
          jd_filename: string | null;
          jd_text: string | null;
          candidate_count: number;
          status: AnalysisStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          job_title?: string | null;
          company_name?: string | null;
          jd_object_key?: string | null;
          jd_filename?: string | null;
          jd_text?: string | null;
          candidate_count?: number;
          status?: AnalysisStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analyses"]["Insert"]>;
        Relationships: [];
      };
      candidates: {
        Row: {
          id: string;
          analysis_id: string;
          name: string | null;
          email: string | null;
          resume_object_key: string | null;
          resume_filename: string;
          resume_text: string | null;
          semantic_score: number | null;
          keyword_score: number | null;
          skill_score: number | null;
          final_score: number | null;
          rank: number | null;
          matched_skills: Json;
          missing_skills: Json;
          explanation: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          analysis_id: string;
          name?: string | null;
          email?: string | null;
          resume_object_key?: string | null;
          resume_filename: string;
          resume_text?: string | null;
          semantic_score?: number | null;
          keyword_score?: number | null;
          skill_score?: number | null;
          final_score?: number | null;
          rank?: number | null;
          matched_skills?: Json;
          missing_skills?: Json;
          explanation?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["candidates"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          analysis_id: string;
          candidate_id: string | null;
          user_id: string;
          document_type: DocumentType;
          filename: string;
          file_extension: DocumentFileExtension;
          object_key: string;
          mime_type: string;
          file_size: number;
          status: DocumentStatus;
          extraction_method: "NATIVE" | "OCR" | null;
          extracted_text: string | null;
          page_count: number | null;
          ocr_used: boolean;
          ocr_provider: string | null;
          char_count: number | null;
          error: string | null;
          processing_attempts: number;
          created_at: string;
          updated_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          analysis_id: string;
          candidate_id?: string | null;
          user_id: string;
          document_type: DocumentType;
          filename: string;
          file_extension: DocumentFileExtension;
          object_key: string;
          mime_type?: string;
          file_size: number;
          status?: DocumentStatus;
          extraction_method?: "NATIVE" | "OCR" | null;
          extracted_text?: string | null;
          page_count?: number | null;
          ocr_used?: boolean;
          ocr_provider?: string | null;
          char_count?: number | null;
          error?: string | null;
          processing_attempts?: number;
          created_at?: string;
          updated_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          analysis_id: string;
          document_id: string;
          candidate_id: string | null;
          user_id: string;
          document_type: DocumentType;
          chunk_index: number;
          page_number: number | null;
          section_label: string | null;
          content: string;
          embedding: number[] | string;
          token_count: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          analysis_id: string;
          document_id: string;
          candidate_id?: string | null;
          user_id: string;
          document_type: DocumentType;
          chunk_index: number;
          page_number?: number | null;
          section_label?: string | null;
          content: string;
          embedding: number[] | string;
          token_count?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_chunks"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_document_chunks: {
        Args: {
          p_analysis_id: string;
          p_query_embedding: number[] | string;
          p_match_count?: number;
          p_similarity_threshold?: number;
        };
        Returns: Array<{
          id: string;
          document_id: string;
          candidate_id: string | null;
          document_type: DocumentType;
          filename: string;
          chunk_index: number;
          page_number: number | null;
          section_label: string | null;
          content: string;
          metadata: Json;
          similarity: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
