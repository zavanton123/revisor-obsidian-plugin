import { Repeat } from "./repeat/repeatTypes";

export interface SavedFilter {
  name: string;
  query: string;
}

export interface RepeatPluginSettings {
  showDueCountInStatusBar: boolean;
  showRibbonIcon: boolean;
  ignoreFolderPath: string;
  filterQuery: string;
  savedFilters: SavedFilter[];
  fsrsRequestRetention: number;
  fsrsMaximumInterval: number;
  fsrsEnableFuzz: boolean;
  fsrsEnableShortTerm: boolean;
  fsrsLearningSteps: string;
  fsrsRelearningSteps: string;
  fsrsWeights: number[] | null;
  dayStartsAt: string;
  confirmForget: boolean;
  forgetResetsCounts: boolean;
  maxNewPerDay: number;
  maxReviewsPerDay: number;
  newCardsIgnoreReviewLimit: boolean;
  showQueueBreakdown: boolean;
}

export const DEFAULT_SETTINGS: RepeatPluginSettings = {
  showDueCountInStatusBar: true,
  showRibbonIcon: true,
  ignoreFolderPath: '',
  filterQuery: '',
  savedFilters: [],
  fsrsRequestRetention: 0.9,
  fsrsMaximumInterval: 36500,
  fsrsEnableFuzz: true,
  fsrsEnableShortTerm: true,
  fsrsLearningSteps: '1m, 10m',
  fsrsRelearningSteps: '10m',
  fsrsWeights: null,
  dayStartsAt: '06:00',
  confirmForget: true,
  forgetResetsCounts: true,
  maxNewPerDay: 0,
  maxReviewsPerDay: 0,
  newCardsIgnoreReviewLimit: false,
  showQueueBreakdown: true,
};

export const DEFAULT_REPEAT: Repeat = {
  repeatTimeOfDay: 'AM',
};
