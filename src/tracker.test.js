import { PerformanceTracker } from './PerformanceTracker.js';

test('registra infracción con regla', () => {
  const tracker = new PerformanceTracker();
  tracker.recordViolation('RULE_21', 5, 'Exceso de velocidad');
  expect(tracker.violations.length).toBe(1);
  expect(tracker.violations[0].ruleId).toBe('RULE_21');
});