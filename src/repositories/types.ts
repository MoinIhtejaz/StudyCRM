import type { StorageMode, StudySnapshot } from "../types/models";

export interface StudyRepository {
  mode: StorageMode;
  load: () => Promise<StudySnapshot>;
  save: (snapshot: StudySnapshot) => Promise<void>;
}
