import type { StoredPreferences } from "../types";
import { DEFAULT_ARTICLE_GROUPS, sanitizeArticleGroups } from "./demand";

const STORAGE_KEY = "rapvis.preferences.v1";

export const DEFAULT_PREFERENCES: StoredPreferences = {
  timeScale: "weeks",
  showLabels: true,
  articleFilter: "Alla",
  articleGroups: DEFAULT_ARTICLE_GROUPS,
};

export function loadPreferences(): StoredPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredPreferences>;
    return {
      timeScale:
        parsed.timeScale === "months" || parsed.timeScale === "years"
          ? parsed.timeScale
          : "weeks",
      showLabels:
        typeof parsed.showLabels === "boolean"
          ? parsed.showLabels
          : DEFAULT_PREFERENCES.showLabels,
      // Always start new sessions on "Alla" instead of restoring the last category.
      articleFilter: DEFAULT_PREFERENCES.articleFilter,
      articleGroups: sanitizeArticleGroups(
        typeof parsed.articleGroups === "object" && parsed.articleGroups
          ? parsed.articleGroups
          : DEFAULT_ARTICLE_GROUPS,
      ),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: StoredPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore quota and storage availability errors. The app remains usable
    // even if preferences cannot be persisted on this device.
  }
}
