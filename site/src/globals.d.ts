// Declarações ambiente: Chart.js vem de um <script> UMD via CDN (sem
// build/bundler), então só declara o global mínimo em vez de instalar
// @types/chart.js (exigiria npm install/node_modules só pra isso). Os
// campos __rbpm* em window são o jeito que o código guarda o último
// estado renderizado pra recriar gráficos na troca de tema, sem precisar
// buscar os dados de novo.
import type { Model, Watchlist } from "./types.js";

// Este arquivo tem "import", então vira um módulo -- sem "declare global"
// a interface Window abaixo ficaria só um merge local, não uma
// augmentation global de verdade.
declare global {
  const Chart: any;

  interface Window {
    __rbpmChart?: any;
    __rbpmModels?: Model[];
    __rbpmSelectedKey?: string;
    __rbpmWatchlist?: Watchlist;
    __rbpmFavorites?: Watchlist;
  }
}
