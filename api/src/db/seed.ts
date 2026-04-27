import { db, runMigrations } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { seedAssets } from '../domain/assets.js';

export function seedDatabase(): void {
  runMigrations();

  const count = (db.prepare('SELECT COUNT(*) AS n FROM assets').get() as { n: number }).n;
  if (count > 0) {
    logger.info({ assets: count }, 'database already seeded — skipping');
    return;
  }

  const insert = db.prepare(`
    INSERT INTO assets (
      id, name, asset_type, primary_voltage_kv, secondary_voltage_kv, rated_power_kva,
      oil_type, install_year, location_name, location_lat, location_lng,
      last_inspection_date, cooling_class
    ) VALUES (
      @id, @name, @assetType, @primaryVoltageKv, @secondaryVoltageKv, @ratedPowerKva,
      @oilType, @installYear, @locationName, @locationLat, @locationLng,
      @lastInspectionDate, @coolingClass
    )
  `);

  const tx = db.transaction(() => {
    for (const a of seedAssets) {
      insert.run({
        id: a.id,
        name: a.name,
        assetType: a.assetType,
        primaryVoltageKv: a.primaryVoltageKv,
        secondaryVoltageKv: a.secondaryVoltageKv,
        ratedPowerKva: a.ratedPowerKva,
        oilType: a.oilType,
        installYear: a.installYear,
        locationName: a.locationName,
        locationLat: a.locationLat ?? null,
        locationLng: a.locationLng ?? null,
        lastInspectionDate: a.lastInspectionDate ?? null,
        coolingClass: a.coolingClass,
      });
    }
  });

  tx();
  logger.info({ assets: seedAssets.length }, 'seeded database');
}
