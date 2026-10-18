import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

/** Shim for grass-ds gap 5 (Spinner). A status region with a visually hidden label. */
@Component({
  selector: 'pb-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <span class="pb-spinner" role="status">
      <span class="pb-spinner__ring" aria-hidden="true"></span>
      <span class="gr-visually-hidden">{{ label() }}</span>
    </span>
  `,
})
export class Spinner {
  readonly label = input.required<string>();
}
