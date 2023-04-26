import { flushPromises } from '@vue/test-utils';

import { MultiStepAction, Step } from '@/actions/steps';
import { generateStepData } from '~/utils/data_generators';

class TestMultiStepAction extends MultiStepAction {
  public executeSteps(methods: Record<string, CallableFunction>): Promise<void> {
    return super.executeSteps(methods);
  }
}

describe('MultiStepAction', () => {
  describe('active', () => {
    it('is true if any step is active', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ active: false })),
        new Step(generateStepData({ active: true })),
        new Step(generateStepData({ active: false })),
      ]);

      expect(action.active).toBeTruthy();
    });

    it('is false if no step is active', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ active: false })),
        new Step(generateStepData({ active: false })),
      ]);

      expect(action.active).toBeFalsy();
    });
  });

  describe('completed', () => {
    it('is true if all steps are completed', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ completed: true })),
        new Step(generateStepData({ completed: true })),
      ]);

      expect(action.completed).toBeTruthy();
    });

    it('is false if any step has not completed', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ completed: true })),
        new Step(generateStepData({ completed: false })),
      ]);

      expect(action.completed).toBeFalsy();
    });
  });

  describe('failed', () => {
    it('is true if any step has failed', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ errorMessage: undefined })),
        new Step(generateStepData({ errorMessage: 'error' })),
      ]);
      expect(action.steps[1].failed).toBeTruthy();

      expect(action.failed).toBeTruthy();
    });

    it('is false if no step has failed', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ errorMessage: undefined })),
        new Step(generateStepData({ errorMessage: undefined })),
      ]);
      expect(action.steps[0].failed).toBeFalsy();
      expect(action.steps[1].failed).toBeFalsy();

      expect(action.failed).toBeFalsy();
    });
  });

  describe('done', () => {
    it('is true if action is completed', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ completed: true })),
        new Step(generateStepData({ completed: true })),
      ]);
      expect(action.completed).toBeTruthy();

      expect(action.done).toBeTruthy();
    });

    it('is true if action has failed', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ completed: true })),
        new Step(generateStepData({ errorMessage: 'error' })),
      ]);
      expect(action.failed).toBeTruthy();

      expect(action.done).toBeTruthy();
    });
  });

  describe('errorMessage', () => {
    it('is the message of the first failed step', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ errorMessage: 'error one' })),
        new Step(generateStepData({ errorMessage: 'error two' })),
      ]);
      expect(action.steps[0].failed).toBeTruthy();
      expect(action.steps[1].failed).toBeTruthy();

      expect(action.errorMessage).toBe('error one');
    });

    it('is undefined if no step has failed', () => {
      const action = new MultiStepAction([
        new Step(generateStepData({ errorMessage: undefined })),
        new Step(generateStepData({ errorMessage: undefined })),
      ]);
      expect(action.steps[0].failed).toBeFalsy();
      expect(action.steps[1].failed).toBeFalsy();

      expect(action.errorMessage).toBeUndefined();
    });
  });

  describe('executeSteps()', () => {
    it('fails if action has already failed', async () => {
      const action = new TestMultiStepAction([
        new Step(generateStepData({ identifier: 'one' })),
        new Step(generateStepData({ identifier: 'two', errorMessage: 'error' })),
      ]);
      const methods = { one: vi.fn(), two: vi.fn() };
      expect(action.failed).toBeTruthy();

      await expect(action.executeSteps(methods)).rejects.toThrow(
        'Attempt to run already failed action!',
      );
    });

    it('fails if action is already active', async () => {
      const action = new TestMultiStepAction([
        new Step(generateStepData({ identifier: 'one' })),
        new Step(generateStepData({ identifier: 'two', active: true })),
      ]);
      const methods = { one: vi.fn(), two: vi.fn() };
      expect(action.active).toBeTruthy();

      await expect(action.executeSteps(methods)).rejects.toThrow(
        'Attempt to run already in progress action!',
      );
    });

    it('fails if any step has no method defined', async () => {
      const action = new TestMultiStepAction([
        new Step(generateStepData({ identifier: 'one' })),
        new Step(generateStepData({ identifier: 'two' })),
        new Step(generateStepData({ identifier: 'three' })),
      ]);
      const methods = { one: vi.fn() };

      await expect(action.executeSteps(methods)).rejects.toThrow(
        'Can not (continue) execution of action. Missing methods for steps: two,three',
      );
    });

    it('ignores missing methods for already completed steps', async () => {
      const action = new TestMultiStepAction([
        new Step(generateStepData({ identifier: 'one', completed: true })),
        new Step(generateStepData({ identifier: 'two' })),
        new Step(generateStepData({ identifier: 'three' })),
      ]);
      const methods = { two: vi.fn() };

      await expect(action.executeSteps(methods)).rejects.toThrow(
        'Can not (continue) execution of action. Missing methods for steps: three',
      );
    });

    it('runs all steps and set them to be complete', async () => {
      const action = new TestMultiStepAction([
        new Step(generateStepData({ identifier: 'one' })),
        new Step(generateStepData({ identifier: 'two' })),
      ]);
      const one = vi.fn();
      const two = vi.fn();
      const methods = { one, two };

      await action.executeSteps(methods);

      expect(one).toHaveBeenCalledTimes(1);
      expect(two).toHaveBeenCalledTimes(1);
      expect(action.steps[0].completed).toBeTruthy();
      expect(action.steps[1].completed).toBeTruthy();
    });

    it('can continue from the last not completed steps', async () => {
      const action = new TestMultiStepAction([
        new Step(generateStepData({ identifier: 'one', completed: true })),
        new Step(generateStepData({ identifier: 'two', completed: false })),
      ]);
      const one = vi.fn();
      const two = vi.fn();
      const methods = { one, two };

      await action.executeSteps(methods);

      expect(one).not.toHaveBeenCalled();
      expect(two).toHaveBeenCalledTimes(1);
      expect(action.steps[1].completed).toBeTruthy();
    });

    it('stops after the first step method fails and preserves its error', async () => {
      const action = new TestMultiStepAction([
        new Step(generateStepData({ identifier: 'one' })),
        new Step(generateStepData({ identifier: 'two' })),
        new Step(generateStepData({ identifier: 'three' })),
      ]);
      const one = vi.fn();
      const two = vi.fn().mockRejectedValue(new Error('error'));
      const three = vi.fn();
      const methods = { one, two, three };

      try {
        await action.executeSteps(methods);
      } catch {
        /* ignore */
      }

      expect(one).toHaveBeenCalledTimes(1);
      expect(action.steps[0].done).toBeTruthy();
      expect(two).toHaveBeenCalledTimes(1);
      expect(action.steps[1].done).toBeTruthy();
      expect(action.steps[1].failed).toBeTruthy();
      expect(action.steps[1].errorMessage).toBe('error');
      expect(three).not.toHaveBeenCalled();
      expect(action.steps[2].done).toBeFalsy();
    });

    it('sets a step as active while executing the related method', async () => {
      const action = new TestMultiStepAction([new Step(generateStepData({ identifier: 'one' }))]);
      const one = vi.fn().mockReturnValue(new Promise(() => undefined)); // never resolves
      const methods = { one };

      action.executeSteps(methods);
      await new Promise((resolve) => setTimeout(resolve, 100)); // sleep

      expect(action.steps[0].active).toBeTruthy();
      expect(action.steps[0].done).toBeFalsy();

      flushPromises();
    });
  });
  describe('emitter', () => {
    it('emits `completed` event when step execution succesfully completed', async () => {
      const action = new TestMultiStepAction([
        new Step(generateStepData({ identifier: 'one' })),
        new Step(generateStepData({ identifier: 'two' })),
      ]);
      const one = vi.fn();
      const two = vi.fn();
      const methods = { one, two };
      const emitMock = vi.fn();
      action.emit = emitMock;

      await action.executeSteps(methods);

      expect(emitMock).toHaveBeenCalledWith('completed');
    });
  });
  it('emits `failed` event when step execution failed', async () => {
    const action = new TestMultiStepAction([
      new Step(generateStepData({ identifier: 'one' })),
      new Step(generateStepData({ identifier: 'two' })),
    ]);
    const one = vi.fn();
    const two = vi.fn().mockImplementation(() => {
      throw new Error('error');
    });

    const methods = { one, two };
    const emitMock = vi.fn();
    action.emit = emitMock;

    await expect(action.executeSteps(methods)).rejects.toThrow('error');

    expect(emitMock).toHaveBeenCalledWith('failed');
  });
});
