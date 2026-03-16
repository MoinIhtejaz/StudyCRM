import { createSeedSnapshot } from "../data/seed";
import type { StudySnapshot } from "../types/models";
import type { StudyRepository } from "./types";

const STORAGE_KEY = "studycrm_snapshot_v1";

const safeParse = (value: string | null): StudySnapshot | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as StudySnapshot;
  } catch (_error) {
    return null;
  }
};

export class LocalStudyRepository implements StudyRepository {
  readonly mode = "local" as const;

  async load(): Promise<StudySnapshot> {
    const snapshot = safeParse(localStorage.getItem(STORAGE_KEY));
    if (snapshot) {
      return snapshot;
    }

    const seedSnapshot = createSeedSnapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedSnapshot));
    return seedSnapshot;
  }

  async save(snapshot: StudySnapshot): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }
}
