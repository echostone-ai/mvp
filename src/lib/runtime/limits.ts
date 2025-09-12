/**
 * Demo clamps - performance limits for consistent fast response
 */

export const DEMO_LIMITS = {
  memoryLimit: 4,
  historyLimit: 4,
  priorityFilter: 4,
  maxTokens: 200,
  temperature: 0.3
} as const;

export const NORMAL_LIMITS = {
  memoryLimit: 8,
  historyLimit: 6,
  priorityFilter: 6,
  maxTokens: 400,
  temperature: 0.4
} as const;

export function getLimits(isDemo: boolean) {
  return isDemo ? DEMO_LIMITS : NORMAL_LIMITS;
}