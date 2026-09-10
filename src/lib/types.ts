export type Canal = "Shopee" | "Mercado Livre" | "TikTok Shop";
export const CANAIS: Canal[] = ["Shopee", "Mercado Livre", "TikTok Shop"];

export type Estado = "esperando" | "recebida" | "chamado" | "indenizada" | "perda";

export interface Devolucao {
  id: string;
  canal: Canal;
  pedido: string;
  produto?: string;
  sku?: string;
  valor: number;
  motivo?: string;
  comprador?: string;
  statusPlataforma?: string;
  aprovadaEm: string;           // YYYY-MM-DD
  rastreio?: string;
  ultimoEventoEm?: string | null;
  entregueEm?: string | null;   // data em que a plataforma marcou a devolucao como entregue
  estado: Estado;
  recebidaEm?: string | null;
  divergente?: boolean;
  grade?: string;
  motivoReal?: string;
  obs?: string;
  contestadaEm?: string | null;
  chamadoEm?: string | null;
  protocolo?: string;
  indenizadaEm?: string | null;
  valorIndenizado?: number | null;
  perdaEm?: string | null;
  criadoEm?: string;
  updatedAt?: string;
  atualizadoPor?: string;
}

export interface PrazoCanal { alerta: number; extravio: number; contestar: number }
export type Config = Record<string, PrazoCanal>;
export type Mappings = Record<string, Record<string, string>>;

export const DEFAULT_CONFIG: Config = {
  "Shopee":        { alerta: 7, extravio: 12, contestar: 2 },
  "Mercado Livre": { alerta: 5, extravio: 10, contestar: 2 },
  "TikTok Shop":   { alerta: 7, extravio: 15, contestar: 2 },
};

export const CAMPOS = [
  { k: "pedido",         l: "Nº do pedido",               req: true },
  { k: "produto",        l: "Produto",                    req: false },
  { k: "sku",            l: "SKU / variação",             req: false },
  { k: "valor",          l: "Valor (R$)",                 req: false },
  { k: "motivo",         l: "Motivo declarado",           req: false },
  { k: "aprovadaEm",     l: "Data da devolução",          req: true },
  { k: "rastreio",       l: "Rastreio reverso",           req: false },
  { k: "ultimoEventoEm", l: "Último evento do rastreio",  req: false },
  { k: "entregueEm",     l: "Devolução entregue em",      req: false },
  { k: "comprador",      l: "Comprador",                  req: false },
  { k: "statusPlataforma", l: "Status na plataforma",     req: false },
] as const;

export const MOTIVOS_REAIS = [
  "tamanho não serviu", "defeito de costura", "cor ou estampa diferente",
  "SKU errado (erro nosso)", "arrependimento", "atraso na entrega",
  "peça suja ou danificada no transporte", "faltou item", "não identificado", "outro",
];

export const GRADES = [
  { g: "A", t: "Volta como nova",     d: "Vapor, dobra, embalagem. Estoque hoje." },
  { g: "B", t: "Segunda linha",       d: "Outlet, kit ou combo." },
  { g: "C", t: "Conserto na facção",  d: "Vai na próxima remessa da costureira." },
  { g: "D", t: "Perda",               d: "Registrada com foto e motivo." },
];
