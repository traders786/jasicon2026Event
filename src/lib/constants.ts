export interface EntitlementDefinition {
  category: 'MEAL' | 'SESSION';
  code: string;
  title: string;
  day?: number;
  timeSlot?: string;
}

// 9 Meals (Day 1 Breakfast/Lunch/Dinner, Day 2 Breakfast/Lunch/Dinner, Day 3 Breakfast/Lunch/Dinner)
export const MEAL_DEFINITIONS: EntitlementDefinition[] = [
  { category: 'MEAL', code: 'MEAL_D1_BREAKFAST', title: 'Day 1: Breakfast Buffet', day: 1, timeSlot: '08:00 - 09:30' },
  { category: 'MEAL', code: 'MEAL_D1_LUNCH', title: 'Day 1: Executive Lunch', day: 1, timeSlot: '12:30 - 14:00' },
  { category: 'MEAL', code: 'MEAL_D1_DINNER', title: 'Day 1: Welcome Gala Dinner', day: 1, timeSlot: '19:00 - 21:30' },
  { category: 'MEAL', code: 'MEAL_D2_BREAKFAST', title: 'Day 2: Breakfast Buffet', day: 2, timeSlot: '08:00 - 09:30' },
  { category: 'MEAL', code: 'MEAL_D2_LUNCH', title: 'Day 2: Executive Lunch', day: 2, timeSlot: '12:30 - 14:00' },
  { category: 'MEAL', code: 'MEAL_D2_DINNER', title: 'Day 2: Networking Banquet', day: 2, timeSlot: '19:00 - 21:30' },
  { category: 'MEAL', code: 'MEAL_D3_BREAKFAST', title: 'Day 3: Breakfast Buffet', day: 3, timeSlot: '08:00 - 09:30' },
  { category: 'MEAL', code: 'MEAL_D3_LUNCH', title: 'Day 3: Farewell Lunch', day: 3, timeSlot: '12:30 - 14:00' },
  { category: 'MEAL', code: 'MEAL_D3_DINNER', title: 'Day 3: Closing Dinner', day: 3, timeSlot: '19:00 - 21:00' },
];

// 10 Sessions (Keynotes, Tracks, Workshops across 3 days)
export const SESSION_DEFINITIONS: EntitlementDefinition[] = [
  { category: 'SESSION', code: 'SES_01_KEYNOTE', title: 'Session 01: Opening Keynote & Future of AI', day: 1, timeSlot: '09:30 - 11:00' },
  { category: 'SESSION', code: 'SES_02_CLOUD_ARCH', title: 'Session 02: Resilient Cloud Architecture', day: 1, timeSlot: '11:15 - 12:30' },
  { category: 'SESSION', code: 'SES_03_SECURITY', title: 'Session 03: Zero-Trust Security Deep Dive', day: 1, timeSlot: '14:30 - 16:00' },
  { category: 'SESSION', code: 'SES_04_DATA_SYSTEMS', title: 'Session 04: High-Throughput Data Systems', day: 1, timeSlot: '16:15 - 17:30' },
  { category: 'SESSION', code: 'SES_05_AI_AGENTS', title: 'Session 05: Autonomous AI Agentic Systems', day: 2, timeSlot: '09:30 - 11:00' },
  { category: 'SESSION', code: 'SES_06_DEVOPS', title: 'Session 06: Modern Platform Engineering', day: 2, timeSlot: '11:15 - 12:30' },
  { category: 'SESSION', code: 'SES_07_WORKSHOP_A', title: 'Session 07: Hands-On Microservices Lab', day: 2, timeSlot: '14:30 - 16:00' },
  { category: 'SESSION', code: 'SES_08_WORKSHOP_B', title: 'Session 08: Distributed Consensus Workshop', day: 2, timeSlot: '16:15 - 17:30' },
  { category: 'SESSION', code: 'SES_09_SCALING', title: 'Session 09: Global Web Performance at Scale', day: 3, timeSlot: '09:30 - 11:30' },
  { category: 'SESSION', code: 'SES_10_CLOSING', title: 'Session 10: Closing Panel & Engineering Awards', day: 3, timeSlot: '14:00 - 16:00' },
];

export const ALL_ENTITLEMENT_DEFINITIONS: EntitlementDefinition[] = [
  ...MEAL_DEFINITIONS,
  ...SESSION_DEFINITIONS,
];
