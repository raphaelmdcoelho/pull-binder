import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, model } from '@angular/core';
import { GrButton } from '@grass-ds/angular';

let nextId = 0;

/** Shim for grass-ds gap 11 (Stepper): minus and plus around a native number input. */
@Component({
  selector: 'pb-quantity-stepper',
  imports: [GrButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="gr-field">
      <label class="gr-field__label" [attr.for]="id">{{ label() }}</label>
      <div class="pb-stepper">
        <button
          grButton
          variant="secondary"
          type="button"
          [attr.aria-label]="decreaseLabel()"
          [disabled]="value() <= min()"
          (click)="step(-1)"
        >
          −
        </button>
        <input
          class="gr-text-field pb-stepper__input"
          type="number"
          inputmode="numeric"
          [id]="id"
          [min]="min()"
          [max]="max()"
          [value]="value()"
          (input)="onInput($any($event.target).value)"
          (blur)="normalise()"
        />
        <button
          grButton
          variant="secondary"
          type="button"
          [attr.aria-label]="increaseLabel()"
          [disabled]="value() >= max()"
          (click)="step(1)"
        >
          +
        </button>
      </div>
    </div>
  `,
})
export class QuantityStepper {
  protected readonly id = `pb-stepper-${nextId++}`;

  readonly label = input.required<string>();
  readonly decreaseLabel = input.required<string>();
  readonly increaseLabel = input.required<string>();
  readonly min = input(1);
  readonly max = input(9999);
  readonly value = model(1);

  protected step(delta: number): void {
    this.value.set(this.clamp(this.value() + delta));
  }

  protected onInput(raw: string): void {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) this.value.set(this.clamp(parsed));
  }

  /** On blur an empty or invalid box snaps back to the current value. */
  protected normalise(): void {
    this.value.set(this.clamp(this.value()));
  }

  private clamp(n: number): number {
    return Math.min(this.max(), Math.max(this.min(), Math.trunc(n)));
  }
}
