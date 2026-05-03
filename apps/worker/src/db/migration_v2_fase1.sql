-- IDS v2 Fase 1: adiciona colunas de cargos exercidos
-- Executar via: wrangler d1 execute senado-db --remote --file=apps/worker/src/db/migration_v2_fase1.sql

ALTER TABLE ranking_snapshots ADD COLUMN cargos_lideranca INTEGER DEFAULT 0;
ALTER TABLE ranking_snapshots ADD COLUMN cargos_titulos TEXT DEFAULT '[]';
