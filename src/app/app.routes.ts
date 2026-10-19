import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'search' },
  {
    path: 'login',
    canActivate: [guestGuard],
    data: { mode: 'login' },
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'sign-up',
    canActivate: [guestGuard],
    data: { mode: 'sign-up' },
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'search',
        loadComponent: () => import('./features/search/search-page').then((m) => m.SearchPage),
      },
      {
        path: 'card/:id',
        loadComponent: () =>
          import('./features/card/card-detail-page').then((m) => m.CardDetailPage),
      },
      {
        path: 'collection',
        loadComponent: () =>
          import('./features/collection/collection-page').then((m) => m.CollectionPage),
      },
      {
        path: 'account',
        loadComponent: () => import('./features/account/account-page').then((m) => m.AccountPage),
      },
    ],
  },
  { path: '**', redirectTo: 'search' },
];
