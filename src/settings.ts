import { Repeat } from "./repeat/repeatTypes";

export interface SavedFilter {
  name: string;
  query: string;  // Dataview FROM expression, e.g. "#math" or "#math AND \"Courses\""
}

export interface RepeatPluginSettings {
  showDueCountInStatusBar: boolean;
  showRibbonIcon: boolean;
  ignoreFolderPath: string;
  morningReviewTime: string;
  eveningReviewTime: string;
  defaultRepeat: Repeat;
  enqueueNonRepeatingNotes: boolean;
  hiddenFieldDefaultValue: boolean;
  filterQuery: string;              // Current Dataview FROM expression
  savedFilters: SavedFilter[];      // Named filter presets
  fsrsEnabled: boolean;
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
    repeatStrategy: 'SPACED',
    repeatPeriod: 1,
    repeatPeriodUnit: 'DAY',
    repeatTimeOfDay: 'AM',
  },
  enqueueNonRepeatingNotes: false,
  hiddenFieldDefaultValue: false,
  filterQuery: '',
  savedFilters: [],
  fsrsEnabled: true,
  fsrsRequestRetention: 0.9,
  fsrsMaximumInterval: 36500,
  fsrsEnableFuzz: true,
  fsrsEnableShortTerm: true,
  fsrsLearningSteps: '1m, 10m',
  fsrsRelearningSteps: '10m',
  fsrsWeights: null,
};
