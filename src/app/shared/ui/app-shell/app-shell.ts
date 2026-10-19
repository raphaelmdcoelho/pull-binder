import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Shim for grass-ds gap 1 (app shell and top bar). Slots: default content, `[banner]` under the top bar, `[nav]` bottom bar. */
@Component({
  selector: 'pb-app-shell',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="pb-app-shell">
      <header class="pb-app-shell__header">
        <div class="gr-container pb-app-shell__bar">
          <p class="pb-app-shell__title">{{ 'app.name' | transloco }}</p>
        </div>
        <ng-content select="[banner]" />
      </header>
      <main class="pb-app-shell__main">
        <div class="gr-container"><ng-content /></div>
      </main>
      <ng-content select="[nav]" />
    </div>
  `,
})
export class AppShell {}
