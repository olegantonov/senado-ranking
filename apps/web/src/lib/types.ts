export type SenadorStatus =
  | 'titular_pleno'
  | 'titular_voltou'
  | 'suplente_efetivo'
  | 'suplente_recente'
  | 'recente'
  | 'afastado'

export type Confianca = 'alta' | 'media' | 'baixa'

export type FilterPreset =
  | 'geral'
  | 'ativos'
  | 'titulares'
  | 'suplentes'
  | 'recentes'
  | 'afastados'

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
  dimProdutividade: number
  dimEfetividade: number
  dimParticipacao: number
  dimFiscalizacao: number
  dimCeap: number
  dimTransparencia: number
  autoriasTotal: number
  autoriasAprovadas: number
  votacaoPresentes: number
  votacoesTotal: number
  relatoriasTotal: number
  discursosTotal: number
  apartesTotal: number
  votacoesComissaoPresentes?: number
  votacoesComissaoTotal?: number
  ceapTotalAno: number
  ceapDivulgacao?: number
  ceapEscritorio?: number
  ceapLocomocao?: number
  ceapConsultoria?: number
  ceapOutros?: number
  pctDivulgacao?: number
  escritoriosCount?: number
  cargosLideranca?: number
  cargosTitulos?: string[]
  posicao?: number
  totalSenadores?: number
  status?: SenadorStatus
  confianca?: Confianca
  idsTotalBruto?: number
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

export interface RankingResponse {
  total: number
  filter?: FilterPreset
  ordenar?: string
  computedAt?: string | null
  empty?: boolean
  data: IdsScore[]
}

export interface AfastadosResponse {
  total: number
  filter: 'afastados'
  data: SenadorAfastado[]
}

export interface MetaResponse {
  partidos: string[]
  ufs: string[]
  blocos: string[]
  statuses?: string[]
  filtros?: FilterPreset[]
  ordenacao?: string[]
}

export interface CeapMes {
  mes: number
  ano: number
  valorTotal: number
}

export interface CeapResponse {
  codigo: string
  ano: number
  meses: CeapMes[]
}

export type SortKey = keyof Pick<
  IdsScore,
  | 'idsTotal'
  | 'dimProdutividade'
  | 'dimEfetividade'
  | 'dimParticipacao'
  | 'dimFiscalizacao'
  | 'dimCeap'
  | 'dimTransparencia'
  | 'nome'
  | 'partido'
  | 'uf'
>

export type SortDir = 'asc' | 'desc'
