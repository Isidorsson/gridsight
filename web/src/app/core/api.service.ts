import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  ApiList,
  Alert,
  Asset,
  BiddingZone,
  DataSource,
  DayAheadPrices,
  GenerationMix,
  ModelCatalog,
  Recommendation,
  TelemetryReading,
  ZoneSummary,
} from './types';

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

  getRecommendation(id: string, model?: string): Observable<Recommendation> {
    let params = new HttpParams();
    if (model) params = params.set('model', model);
    return this.http.post<Recommendation>(
      `${this.base}/v1/assets/${encodeURIComponent(id)}/recommendations`,
      {},
      { params },
    );
  }

  listModels(): Observable<ModelCatalog> {
    return this.http.get<ModelCatalog>(`${this.base}/v1/llm/models`);
  }

  listAlerts(status: 'open' | 'ack' | 'resolved' | 'all' = 'open'): Observable<ApiList<Alert>> {
    return this.http.get<ApiList<Alert>>(`${this.base}/v1/alerts`, { params: { status } });
  }

  ackAlert(id: string, user: string): Observable<Alert> {
    return this.http.post<Alert>(`${this.base}/v1/alerts/${encodeURIComponent(id)}/ack`, { user });
  }

  listGridZones(): Observable<ApiList<BiddingZone>> {
    return this.http.get<ApiList<BiddingZone>>(`${this.base}/v1/grid/zones`);
  }

  getGridSummary(source: DataSource = 'auto'): Observable<ApiList<ZoneSummary>> {
    return this.http.get<ApiList<ZoneSummary>>(`${this.base}/v1/grid/summary`, { params: { source } });
  }

  getGridMix(zone: string, source: DataSource = 'auto'): Observable<GenerationMix> {
    return this.http.get<GenerationMix>(`${this.base}/v1/grid/mix`, { params: { zone, source } });
  }

  getGridPrices(zone: string, source: DataSource = 'auto'): Observable<DayAheadPrices> {
    return this.http.get<DayAheadPrices>(`${this.base}/v1/grid/prices`, { params: { zone, source } });
  }
}
