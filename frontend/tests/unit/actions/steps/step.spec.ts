import { Step } from '@/actions/steps/step';
import { generateStepData } from '~/utils/data_generators';

describe('Step', () => {
  describe('new()', () => {
    it('provides a simple way to create by identifier and label', () => {
      const step = Step.new('testIdentifier', 'test label');

      expect(step.identifier).toBe('testIdentifier');
      expect(step.label).toBe('test label');
      expect(step.completed).toBe(false);
      expect(step.active).toBe(false);
      expect(step.errorMessage).toBeUndefined();
    });
  });

  describe('failed', () => {
    it('is true if an error message is defined', () => {
      const data = generateStepData({ errorMessage: 'test error message' });
      const step = new Step(data);

      expect(step.failed).toBeTruthy();
    });

    it('is false if no error message is defined', () => {
      const data = generateStepData({ errorMessage: undefined });
      const step = new Step(data);

      expect(step.failed).toBeFalsy();
    });
  });

  describe('done', () => {
    it('is false per default', () => {
      const step = Step.new('foo', 'foo');

      expect(step.done).toBeFalsy();
    });

    it('is true if not active and completed', () => {
      const data = generateStepData({ active: false, completed: true });
      const step = new Step(data);

      expect(step.done).toBeTruthy();
    });

    it('is true if the step has failed', () => {
      const data = generateStepData({ active: false, errorMessage: 'test error message' });
      const step = new Step(data);
      expect(step.failed).toBeTruthy();

      expect(step.done).toBeTruthy();
    });

    it('is false when step is active', () => {
      const data = generateStepData({ active: true, completed: true });
      const step = new Step(data);

      expect(step.done).toBeFalsy();
    });
  });

  describe('activate()', () => {
    it('is possible when not already active and done', () => {
      const data = generateStepData({ active: false, completed: false, errorMessage: undefined });
      const step = new Step(data);
      expect(step.done).toBeFalsy();

      step.activate();

      expect(step.active).toBeTruthy();
    });

    it('fails if step is already active', () => {
      const data = generateStepData({ active: true });
      const step = new Step(data);

      expect(() => step.activate()).toThrow('Tried to activate already active or finished step!');
    });

    it('fails if step is already done', () => {
      const data = generateStepData({ completed: true });
      const step = new Step(data);
      expect(step.done).toBeTruthy();

      expect(() => step.activate()).toThrow('Tried to activate already active or finished step!');
    });
  });

  describe('deactivate()', () => {
    it('is possible when step is currently active', () => {
      const data = generateStepData({ active: true });
      const step = new Step(data);

      step.deactivate();

      expect(step.active).toBeFalsy();
    });

    it('fails if step is not currently active', () => {
      const data = generateStepData({ active: false });
      const step = new Step(data);

      expect(() => step.deactivate()).toThrow('Can not deactivate not active step!');
    });
  });

  describe('complete()', () => {
    it('is possible when step is not already done', () => {
      const data = generateStepData({ completed: false });
      const step = new Step(data);
      expect(step.done).toBeFalsy();

      step.complete();

      expect(step.completed).toBeTruthy();
    });

    it('fails if step is already done', () => {
      const data = generateStepData({ completed: true });
      const step = new Step(data);
      expect(step.done).toBeTruthy();

      expect(() => step.complete()).toThrow('Can not complete already completed or failed step!');
    });
  });

  describe('setErrorMessage()', () => {
    it('is possible when step is not already done', () => {
      const data = generateStepData({ errorMessage: undefined });
      const step = new Step(data);
      expect(step.done).toBeFalsy();

      step.setErrorMessage('test error message');

      expect(step.errorMessage).toBe('test error message');
    });

    it('fails if step is already done', () => {
      const data = generateStepData({ errorMessage: 'test error message' });
      const step = new Step(data);
      expect(step.done).toBeTruthy();

      expect(() => step.complete()).toThrow('Can not complete already completed or failed step!');
    });
  });

  describe('encode()', () => {
    it('serializes all data to persist the step', () => {
      const data = {
        identifier: 'testIdentifier',
        label: 'test label',
        active: true,
        completed: true,
        errorMessage: 'test error message',
      };
      const step = new Step(data);

      const encodedData = step.encode();

      expect(encodedData.identifier).toBe('testIdentifier');
      expect(encodedData.label).toBe('test label');
      expect(encodedData.active).toBe(true);
      expect(encodedData.completed).toBe(true);
      expect(encodedData.errorMessage).toBe('test error message');
    });

    it('can be used to re-instantiate step again', () => {
      const data = generateStepData();
      const step = new Step(data);

      const encodedData = step.encode();
      const newStep = new Step(encodedData);
      const newEncodedData = newStep.encode();

      expect(encodedData).toMatchObject(newEncodedData);
    });
  });
});
