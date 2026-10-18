import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'search' },
  {
    path: 'search',
    title: 'PullBinder',
    loadComponent: () => import('./features/search/search-page').then((m) => m.SearchPage),
  },
  {
    path: 'collection',
    title: 'PullBinder',
    loadComponent: () =>
      import('./features/collection/collection-page').then((m) => m.CollectionPage),
  },
  {
    path: 'account',
    title: 'PullBinder',
    loadComponent: () => import('./features/account/account-page').then((m) => m.AccountPage),
  },
  { path: '**', redirectTo: 'search' },
];
