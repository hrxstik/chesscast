-- Обновление бесплатного тарифа без полного пересида (PostgreSQL).
-- Лимит: 3 партии в сутки, трансляция включена, организации недоступны.

UPDATE "Plan"
SET
  "maxGamesPerPeriod" = 3,
  "maxOrganizations" = 0,
  "canCreateOrganization" = false,
  "canStream" = true,
  "streamQualityLevel" = 'LOW',
  "features" = ARRAY[
    'До 3 личных партий в сутки',
    'Трансляция с распознаванием доски',
    'Без создания организаций'
  ]::text[]
WHERE "code" = 'FREE';
