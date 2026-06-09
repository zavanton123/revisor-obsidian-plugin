export type QueueMode = 'normal' | 'new-only' | 'reviews-only';

export type CustomStudyKind = 'review-ahead' | 'lapses-only' | 'never-reviewed';

export interface CustomStudyConfig {
  kind: CustomStudyKind;
  daysAhead?: number;
}

export interface SessionStudyConfig {
  queueMode: QueueMode;
  customStudy?: CustomStudyConfig;
  sessionNewLimit: number;
  sessionReviewLimit: number;
  sessionNewStudied: number;
  sessionReviewStudied: number;
}

export const DEFAULT_SESSION_CONFIG: SessionStudyConfig = {
  queueMode: 'normal',
  sessionNewLimit: 0,
  sessionReviewLimit: 0,
  sessionNewStudied: 0,
  sessionReviewStudied: 0,
};

export function createSessionConfig(
  overrides: Partial<SessionStudyConfig> = {},
): SessionStudyConfig {
  return { ...DEFAULT_SESSION_CONFIG, ...overrides };
}

export function resetSessionCounters(
  session: SessionStudyConfig,
): SessionStudyConfig {
  return {
    ...session,
    sessionNewStudied: 0,
    sessionReviewStudied: 0,
  };
}

export function endCustomStudy(
  session: SessionStudyConfig,
): SessionStudyConfig {
  return {
    ...session,
    queueMode: 'normal',
    customStudy: undefined,
  };
}
