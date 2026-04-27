import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard — GridSight',
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
