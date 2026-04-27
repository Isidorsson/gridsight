import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { ApiList, Alert, Asset, Recommendation, TelemetryReading } from './types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listAssets(): Observable<ApiList<Asset>> {
    return this.http.get<ApiList<Asset>>(`${this.base}/v1/assets`);
  }

  getAsset(id: string): Observable<Asset> {
    return this.http.get<Asset>(`${this.base}/v1/assets/${encodeURIComponent(id)}`);
  }

  getTelemetry(id: string, limit = 120): Observable<ApiList<TelemetryReading>> {
    return this.http.get<ApiList<TelemetryReading>>(
      `${this.base}/v1/assets/${encodeURIComponent(id)}/telemetry`,
      { params: { limit } },
    );
  }

  getRecommendation(id: string): Observable<Recommendation> {
    return this.http.post<Recommendation>(
      `${this.base}/v1/assets/${encodeURIComponent(id)}/recommendations`,
      {},
    );
  }

  listAlerts(status: 'open' | 'ack' | 'resolved' | 'all' = 'open'): Observable<ApiList<Alert>> {
    return this.http.get<ApiList<Alert>>(`${this.base}/v1/alerts`, { params: { status } });
  }

  ackAlert(id: string, user: string): Observable<Alert> {
    return this.http.post<Alert>(`${this.base}/v1/alerts/${encodeURIComponent(id)}/ack`, { user });
  }
}
