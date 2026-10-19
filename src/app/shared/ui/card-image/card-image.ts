import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
  signal,
} from '@angular/core';
import { Skeleton } from '../skeleton/skeleton';

/**
 * Shim for grass-ds gap 9 (Image and card grid). A card scan at the fixed 63:88 ratio: a skeleton
 * while it loads, lazy loading, and a plain placeholder when there is no image or it fails.
 */
@Component({
  selector: 'pb-card-image',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'pb-card-image' },
  template: `
    @if (src() && !failed()) {
      @if (!loaded()) {
        <pb-skeleton class="pb-card-image__placeholder" />
      }
      <img
        class="pb-card-image__img"
        [src]="src()"
        [alt]="alt()"
        [attr.loading]="eager() ? 'eager' : 'lazy'"
        decoding="async"
        crossorigin="anonymous"
        width="63"
        height="88"
        (load)="loaded.set(true)"
        (error)="failed.set(true)"
      />
    } @else {
      <div class="pb-card-image__fallback" role="img" [attr.aria-label]="alt()">
        <span aria-hidden="true">?</span>
      </div>
    }
  `,
})
export class CardImage {
  readonly src = input<string | null>(null);
  readonly alt = input.required<string>();
  readonly eager = input(false);

  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly hasImage = computed(() => !!this.src() && !this.failed());
}
