import { SupabaseStudyRepository } from "./supabaseRepository";
import type { StudyRepository } from "./types";

export const getPreferredRepository = (): StudyRepository => {
  return new SupabaseStudyRepository();
};
