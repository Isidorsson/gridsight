import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { HttpInterceptorFn } from '@angular/common/http';
import { routes } from './app.routes';

const errorLogInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      if (err?.status >= 500) {
        console.error(`[api] ${req.method} ${req.urlWithParams} → ${err.status}`, err.error);
      }
      return throwError(() => err);
    }),
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([errorLogInterceptor])),
    provideAnimationsAsync(),
  ],
};
