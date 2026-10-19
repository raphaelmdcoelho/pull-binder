import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from './core/auth/auth.service';
import { AppShell } from './shared/ui/app-shell/app-shell';
import { TabBar, TabBarItem } from './shared/ui/tab-bar/tab-bar';

@Component({
  selector: 'pb-root',
  imports: [RouterOutlet, TranslocoPipe, AppShell, TabBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pb-app-shell>
      <router-outlet />
      @if (auth.isAuthenticated()) {
        <pb-tab-bar nav [items]="tabs" [label]="'nav.label' | transloco" />
      }
    </pb-app-shell>
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly tabs: readonly TabBarItem[] = [
    { path: '/search', labelKey: 'nav.search', icon: 'search' },
    { path: '/collection', labelKey: 'nav.collection', icon: 'collection' },
    { path: '/account', labelKey: 'nav.account', icon: 'account' },
  ];
}
