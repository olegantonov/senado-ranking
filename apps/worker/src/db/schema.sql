-- Senado Ranking D1 Schema (IDS v2)

-- Snapshots do ranking IDS calculado pelo cron
CREATE TABLE IF NOT EXISTS ranking_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  computed_at TEXT    NOT NULL DEFAULT (datetime('now')),
  senador_cod TEXT    NOT NULL,
  nome        TEXT    NOT NULL,
  partido     TEXT,
  uf          TEXT,
  bloco       TEXT,
  foto_url    TEXT,
  -- Janela temporal (Leg 57)
  data_inicio_exercicio TEXT,
  meses_ativos INTEGER DEFAULT 0,
  -- Acomodação parlamentar
  auxilio_moradia INTEGER DEFAULT 0,
  imovel_funcional INTEGER DEFAULT 0,
  -- Dimensões IDS (0–100)
  ids_total        REAL NOT NULL,
  dim_produtividade REAL NOT NULL,
  dim_efetividade   REAL NOT NULL,
  dim_participacao  REAL NOT NULL,
  dim_fiscalizacao  REAL NOT NULL,
  dim_ceap          REAL NOT NULL,
  dim_transparencia REAL NOT NULL,
  -- Dados brutos de suporte
  autorias_total    INTEGER DEFAULT 0,
  autorias_aprovadas INTEGER DEFAULT 0,
  votacoes_presentes INTEGER DEFAULT 0,
  votacoes_total    INTEGER DEFAULT 0,
  votacoes_comissao_presentes INTEGER DEFAULT 0,
  votacoes_comissao_total INTEGER DEFAULT 0,
  relatorias_total  INTEGER DEFAULT 0,
  discursos_total   INTEGER DEFAULT 0,
  apartes_total     INTEGER DEFAULT 0,
  ceap_total_ano    REAL DEFAULT 0,
  ceap_divulgacao   REAL DEFAULT 0,
  ceap_escritorio   REAL DEFAULT 0,
  ceap_locomocao    REAL DEFAULT 0,
  ceap_consultoria  REAL DEFAULT 0,
  ceap_outros       REAL DEFAULT 0,
  pct_divulgacao    REAL DEFAULT 0,
  escritorios_count INTEGER DEFAULT 0,
  -- IDS v2: cargos exercidos (informativo + ajuste fiscalização)
  cargos_lideranca  REAL DEFAULT 0,
  cargos_titulos    TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_ranking_computed_at ON ranking_snapshots(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_senador_cod ON ranking_snapshots(senador_cod);

-- Cache dos dados de senadores (lista + detalhes)
CREATE TABLE IF NOT EXISTS senadores_cache (
  cod         TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  partido     TEXT,
  uf          TEXT,
  bloco       TEXT,
  foto_url    TEXT,
  email       TEXT,
  raw_json    TEXT,
  cached_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cache dos dados CEAP
CREATE TABLE IF NOT EXISTS ceap_cache (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  senador_cod TEXT NOT NULL,
  ano         INTEGER NOT NULL,
  mes         INTEGER NOT NULL,
  valor_total REAL NOT NULL DEFAULT 0,
  raw_json    TEXT,
  cached_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(senador_cod, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_ceap_senador ON ceap_cache(senador_cod, ano);
