import { ScoringSystem } from './ScoringSystem.js';

test('penaliza correctamente', () => {
  const fakeUI = { showMessage: jest.fn() };
  const scoring = new ScoringSystem(fakeUI);
  scoring.penalize('RULE_21', 5);
  expect(fakeUI.showMessage).toHaveBeenCalled();
});