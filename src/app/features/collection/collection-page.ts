import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pb-collection-page',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gr-stack">
      <h1 class="gr-display">{{ 'collection.title' | transloco }}</h1>
      <section class="gr-card" aria-labelledby="empty-title">
        <div class="gr-card__body gr-stack">
          <h2 class="gr-card__title" id="empty-title">{{ 'collection.emptyTitle' | transloco }}</h2>
          <p class="gr-text-muted">{{ 'collection.emptyBody' | transloco }}</p>
        </div>
      </section>
    </div>
  `,
})
export class CollectionPage {}
