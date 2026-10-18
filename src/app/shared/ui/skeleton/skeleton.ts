import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

/** Shim for grass-ds gap 5 (Skeleton). `rect` defaults to the 63:88 ratio of a Pokémon card. */
@Component({
  selector: 'pb-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'pb-skeleton', 'aria-hidden': 'true', '[attr.data-shape]': 'shape()' },
  template: '',
})
export class Skeleton {
  readonly shape = input<'text' | 'rect' | 'circle'>('rect');
}
