import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

export interface TabBarItem {
  path: string;
  labelKey: string;
  icon: 'search' | 'collection' | 'account';
}

const ICONS: Record<TabBarItem['icon'], string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  collection: 'M5 4h14v16H5zM9 4v16M5 12h4',
  account: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 20a8 8 0 0 1 16 0',
};

/** Shim for grass-ds gap 2 (bottom tab bar). A `<nav>` of links; the active one has aria-current. */
@Component({
  selector: 'pb-tab-bar',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <nav class="pb-tab-bar" [attr.aria-label]="label()">
      <ul class="pb-tab-bar__list">
        @for (item of items(); track item.path) {
          <li>
            <a
              class="pb-tab-bar__link"
              [routerLink]="item.path"
              routerLinkActive
              ariaCurrentWhenActive="page"
            >
              <svg class="pb-tab-bar__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path [attr.d]="icons[item.icon]" />
              </svg>
              <span>{{ item.labelKey | transloco }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class TabBar {
  readonly items = input.required<readonly TabBarItem[]>();
  readonly label = input.required<string>();
  protected readonly icons = ICONS;
}
