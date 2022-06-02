import type { Step } from './step';

export class MultiStepAction {
  readonly _steps: Array<Step>;

  constructor(steps: Array<Step>) {
    this._steps = steps;
  }

  get steps(): Array<Step> {
    return this._steps;
  }

  /**
   * Signals that any step is currently in progress.
   */
  get active(): boolean {
    return this.steps.some((step) => step.active);
  }

  /**
   * Signals that all steps have successfully completed.
   */
  get completed(): boolean {
    return this.steps.every((step) => step.completed);
  }

  /**
   * Signals that any step has failed with an error.
   */
  get failed(): boolean {
    return this.steps.some((step) => step.failed);
  }

  /**
   * Signals that either all steps have completed successfully or any step has
   * failed with an error.
   */
  get done(): boolean {
    return !this.active && (this.failed || this.completed);
  }

  get errorMessage(): string | undefined {
    for (const step of this.steps) {
      if (step.failed) {
        return step.errorMessage;
      }
    }
  }

  protected async executeSteps(methods: Record<string, CallableFunction>): Promise<void> {
    if (this.failed) {
      throw new Error('Attempt to run already failed action!');
    }

    if (this.active) {
      throw new Error('Attempt to run already in progress action!');
    }

    const notCompletedSteps = getNotCompletedSteps(this.steps);
    const stepsWithMissingMethod = findStepsWithMissingMethod(notCompletedSteps, methods);

    if (stepsWithMissingMethod.length > 0) {
      throw new Error(
        'Can not (continue) execution of action. ' +
          `Missing methods for steps: ${stepsWithMissingMethod.map((step) => step.identifier)}`,
      );
    }

    for (const step of notCompletedSteps) {
      const method = methods[step.identifier];
      step.activate();

      try {
        await method();
        step.complete();
      } catch (error) {
        step.setErrorMessage((error as { message?: string }).message ?? 'Unknown failure!');
        throw error;
      } finally {
        step.deactivate();
      }
    }
  }
}

function getNotCompletedSteps(steps: Array<Step>): Array<Step> {
  return steps.filter((step) => !step.completed);
}

function findStepsWithMissingMethod(
  steps: Array<Step>,
  methods: Record<string, CallableFunction>,
): Array<Step> {
  return steps.filter((step) => methods[step.identifier] === undefined);
}
