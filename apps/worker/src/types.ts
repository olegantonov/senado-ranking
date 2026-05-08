// Types shared between worker services and routes

export type SenadorStatus =
  | 'titular_pleno'
  | 'titular_voltou'
  | 'suplente_efetivo'
  | 'suplente_recente'
  | 'recente'
  | 'afastado'

export type Confianca = 'alta' | 'media' | 'baixa'

export interface Senador {
  codigo: string
  nome: string
  partido: string
  uf: string
  bloco: string
  fotoUrl: string
  email?: string
  dataInicioExercicio?: string
  mesesAtivos?: number
  status?: SenadorStatus
  confianca?: Confianca
}

export interface SenadorAfastado {
  codigo: string
  nome: string
  partido: string
  uf: string
  fotoUrl?: string
  motivo: string
  dataInicio: string
  dataFim?: string
}

export interface IdsScore {
  senadorCod: string
  nome: string
  partido: string
  uf: string
  bloco: string
  fotoUrl?: string
  dataInicioExercicio?: string
  mesesAtivos?: number
  auxilioMoradia?: boolean
  imovelFuncional?: boolean
  idsTotal: number
  // Dimensões IDS v2 (0-100, normalizadas)
  dimProdutividade: number
  dimEfetividade: number
  dimParticipacao: number
  dimFiscalizacao: number
  dimCeap: number
  dimTransparencia: number
  // Indicadores brutos
  autoriasTotal: number
  autoriasAprovadas: number
  votacaoPresentes: number
  votacoesTotal: number
  votacoesComissaoPresentes?: number
  votacoesComissaoTotal?: number
  relatoriasTotal: number
  discursosTotal: number
  apartesTotal: number
  ceapTotalAno: number
  // CEAP breakdown (IDS v2 Fase 2)
  ceapDivulgacao?: number
  ceapEscritorio?: number
  ceapLocomocao?: number
  ceapConsultoria?: number
  ceapOutros?: number
  pctDivulgacao?: number
  escritoriosCount?: number
  // Cargos exercidos (informativo, não entra no IDS)
  cargosLideranca?: number
  cargosTitulos?: string[]
  // IDS v3: shrinkage por tempo de mandato + status
  status?: SenadorStatus
  confianca?: Confianca
  idsTotalBruto?: number
}

export interface RawDimensions {
  autoriasTotal: number
  autoriasAprovadas: number
  // IDS v2: produtividade ponderada por tipo de proposição
  produtividadePonderada: number
  // IDS v2: efetividade ponderada por status × tipo
  efetividadePonderada: number
  efetividadeBase: number // soma de pesos das proposições (denominador)
  votacoesPresentes: number
  votacoesTotal: number
  votacoesComissaoPresentes: number
  votacoesComissaoTotal: number
  relatoriasTotal: number
  discursosTotal: number
  apartesTotal: number
  cargosLideranca: number
  cargosTitulos: string[]
  ceapTotalAno: number
  // CEAP breakdown (Fase 2)
  ceapDivulgacao?: number
  ceapEscritorio?: number
  ceapLocomocao?: number
  ceapConsultoria?: number
  ceapOutros?: number
  escritoriosCount?: number
}

export interface CeapMes {
  mes: number
  ano: number
  valorTotal: number
}

export interface Env {
  SENADO_CACHE: KVNamespace
  SENADO_DB: D1Database
  LEGIS_BASE_URL: string
  ADM_BASE_URL: string
  CACHE_TTL: string
  ENVIRONMENT: string
  ADMIN_SECRET: string
  RESEND_API_KEY?: string
}
