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
}

export interface RankingResponse {
  total: number
  computedAt?: string | null
  data: IdsScore[]
}

export interface MetaResponse {
  partidos: string[]
  ufs: string[]
  blocos: string[]
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
