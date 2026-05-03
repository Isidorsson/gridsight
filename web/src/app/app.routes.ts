import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/showcase/showcase.component').then((m) => m.ShowcaseComponent),
    title: 'GridSight — distribution-grid asset health & European grid mix',
  },
  {
    path: 'fleet',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Fleet — GridSight',
  },
  {
    path: 'grid',
    loadComponent: () =>
      import('./features/grid-mix/grid-mix.component').then((m) => m.GridMixComponent),
    title: 'European Grid Mix — GridSight',
  },
  {
    path: 'assets/:id',
    loadComponent: () =>
      import('./features/asset-detail/asset-detail.component').then((m) => m.AssetDetailComponent),
    title: 'Asset Detail — GridSight',
  },
  {
    path: 'alerts',
    loadComponent: () =>
      import('./features/alerts/alerts.component').then((m) => m.AlertsComponent),
    title: 'Alerts — GridSight',
  },
  { path: '**', redirectTo: '' },
];
