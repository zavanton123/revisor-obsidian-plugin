import { Repeat } from "./repeat/repeatTypes";

export interface SavedFilter {
  name: string;
  query: string;
}

export interface RepeatPluginSettings {
  showDueCountInStatusBar: boolean;
  showRibbonIcon: boolean;
  ignoreFolderPath: string;
  morningReviewTime: string;
  eveningReviewTime: string;
  defaultRepeat: Repeat;
  enqueueNonRepeatingNotes: boolean;
  filterQuery: string;
  savedFilters: SavedFilter[];
  fsrsRequestRetention: number;
  fsrsMaximumInterval: number;
  fsrsEnableFuzz: boolean;
  fsrsEnableShortTerm: boolean;
  fsrsLearningSteps: string;
  fsrsRelearningSteps: string;
  fsrsWeights: number[] | null;
}

export const DEFAULT_SETTINGS: RepeatPluginSettings = {
  showDueCountInStatusBar: true,
  showRibbonIcon: true,
  ignoreFolderPath: '',
  morningReviewTime: '06:00',
  eveningReviewTime: '18:00',
  defaultRepeat: {
    repeatTimeOfDay: 'AM',
  },
  enqueueNonRepeatingNotes: false,
  filterQuery: '',
  savedFilters: [],
  fsrsRequestRetention: 0.9,
  fsrsMaximumInterval: 36500,
  fsrsEnableFuzz: true,
  fsrsEnableShortTerm: true,
  fsrsLearningSteps: '1m, 10m',
  fsrsRelearningSteps: '10m',
  fsrsWeights: null,
};
