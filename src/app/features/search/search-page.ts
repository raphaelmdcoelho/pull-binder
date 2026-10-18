import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SearchField } from '../../shared/ui/search-field/search-field';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';

@Component({
  selector: 'pb-search-page',
  imports: [TranslocoPipe, SearchField, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gr-stack">
      <h1 class="gr-display">{{ 'search.title' | transloco }}</h1>
      <pb-search-field
        [label]="'search.label' | transloco"
        [placeholder]="'search.placeholder' | transloco"
        [clearLabel]="'search.clear' | transloco"
        [(value)]="query"
      />
      <p class="gr-text-muted">{{ 'search.hint' | transloco }}</p>
      <div class="gr-grid" data-gap="tight" aria-hidden="true">
        @for (n of placeholders; track n) {
          <pb-skeleton />
        }
      </div>
    </div>
  `,
})
export class SearchPage {
  protected readonly query = signal('');
  protected readonly placeholders = [1, 2, 3, 4];
}
