// IA local (grátis) via Ollama, para economizar o Claude em perguntas simples.
//
// - `triagem(texto)` decide quem responde: 'local' (dicionário, sinônimo, tradução, ortografia, conversão,
//   pergunta curta de conhecimento estável) ou 'claude' (tarefas, pedidos aos agentes, coisas que mudam com
//   o tempo, como notícias/preços/"hoje"). Na dúvida, vai para o Claude.
//   Prefixos manuais: "/local ..." força a IA local; "/claude ..." força o Claude.
// - `perguntar(prompt)` chama a API do Ollama (http://127.0.0.1:11434) sem "modo pensamento", com timeout.
// - Também é usada pelos scripts do canal (hashtags, resumos): import { IaLocal } from '../server/ia-local.js'.
//
// Se o Ollama estiver desligado ou o modelo não estiver baixado, quem chama cai para o Claude.

// Versões "instruct": respondem direto, sem gastar tempo "pensando" (as tags qwen3:4b / qwen3:8b puras
// hoje apontam para versões que sempre raciocinam antes, o que deixa a resposta lenta e em inglês).
export const MODELOS = {
  'qwen3:4b-instruct': 'Rápido: cabe inteiro numa placa de 4 GB (~2,5 GB) — padrão',
  'qwen3:30b-a3b-instruct-2507-q4_K_M': 'Máxima qualidade: ~19 GB de RAM, um pouco mais lento',
};
export const MODELO_PADRAO = 'qwen3:4b-instruct';

const SISTEMA = [
  'Você é o assistente local de um escritório de IA brasileiro. Responda SEMPRE em português do Brasil,',
  'de forma curta e direta (no máximo 6 linhas, salvo se pedirem uma lista).',
  'Serve para: significado de palavras, sinônimos, antônimos, ortografia, gramática, tradução, conversão de',
  'unidades, contas e definições simples. Se não tiver certeza, diga que não tem certeza.',
  'Não invente notícias, preços, datas recentes ou fatos atuais: para isso diga "isso precisa da equipe (Claude)".',
].join(' ');

// Pedidos simples (cobrem o "tipo dicionário" e afins)
const SIMPLES = [
  /\b(o que (significa|quer dizer|é a palavra)|significado d[eao]s?|defini[çc][ãa]o d[eao]s?|defina)\b/i,
  /\b(sin[oô]nimos?|ant[oô]nimos?|rimas? com|palavras? parecidas?)\b/i,
  /\b(como se escreve|escreve-se|[ée] com (s|ss|ç|z|x|ch|g|j)\b|grafia|acentua[çc][ãa]o|crase|plural d[eao]|feminino d[eao]|conjuga[çc][ãa]o|conjugue|separa[çc][ãa]o sil[áa]bica|divis[ãa]o sil[áa]bica)/i,
  /\b(traduz(a|ir)?|tradu[çc][ãa]o|como se diz|em ingl[êe]s|em espanhol|em portugu[êe]s|to english|in english)\b/i,
  /\b(converta|converter|convers[ãa]o|quantos? (cm|metros|km|gramas|kg|litros|ml|minutos|segundos|horas|dias)|em (graus|celsius|fahrenheit|polegadas|p[ée]s))\b/i,
  /^\s*(quanto [ée]|calcule|calcula)\s+[\d(]/i,
  /\b(corrija|corrigir|revise) (essa|esta|a) (frase|palavra)\b/i,
];
// Sinais de que precisa do Claude/agentes (tarefa, ferramenta, informação atual)
const COMPLEXO = [
  /\b(crie|fa[çc]a|produza|produzir|gere|gerar|monte|montar|edite|editar|poste|postar|publique|publicar|programe|instale|rode|execute|delegue|organize|planeje|escreva um (roteiro|post|texto|c[óo]digo|v[íi]deo))\b/i,
  /\b(v[íi]deo|roteiro|legenda do post|hashtags? para|post|reels|tiktok|instagram|canal|boletim|pauta|arquivo|pasta|site|c[óo]digo|servidor|bug|erro no)\b/i,
  /\b(trailers?|gta|jogos?|games?|gamer|steam|epic|playstation|ps[45]|xbox|nintendo|switch|rockstar|lan[çc]ou|vazou|rumor)\b/i,
  /\b(hoje|agora|ontem|amanh[ãa]|esta semana|[úu]ltim[ao]s?|recente|atual|lan[çc]amentos?|not[íi]cias?|pre[çc]os?|promo[çc][ãa]o|promo[çc][õo]es|quanto custa|cota[çc][ãa]o|placar|clima|previs[ãa]o)\b/i,
  /\b(otto|rita|edu|ana|paulo|davi|duda|vera|bia|equipe|agentes?|orquestrador|roteirista|editor|animador|programador|desenvolvedor|designer|revisor|pesquisador|locutor|social.?media)\b/i,
];

/**
 * @returns {{ destino: 'local'|'claude', texto: string, motivo: string }}
 */
export function triagem(texto, { nomesAgentes = [] } = {}) {
  const t = String(texto || '').trim();
  const m = t.match(/^\/(local|claude)\b\s*/i);
  if (m) return { destino: m[1].toLowerCase(), texto: t.slice(m[0].length), motivo: 'pedido manual (/' + m[1].toLowerCase() + ')' };
  if (t.length > 280 || t.split('\n').length > 3) return { destino: 'claude', texto: t, motivo: 'texto longo' };
  const nomes = nomesAgentes.filter(Boolean).map((n) => n.toLowerCase());
  if (nomes.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t))) {
    return { destino: 'claude', texto: t, motivo: 'citou um agente' };
  }
  if (COMPLEXO.some((r) => r.test(t))) return { destino: 'claude', texto: t, motivo: 'tarefa ou informação atual' };
  if (SIMPLES.some((r) => r.test(t))) return { destino: 'local', texto: t, motivo: 'pergunta simples' };
  return { destino: 'claude', texto: t, motivo: 'na dúvida, Claude' };
}

/** Remove blocos <think>…</think> que alguns modelos ainda mandam. */
export function limparResposta(s) {
  let t = String(s || '');
  // algumas versões do Ollama devolvem o raciocínio sem a tag de abertura: fica só o que vem depois do último </think>
  const fim = t.lastIndexOf('</think>');
  if (fim >= 0) t = t.slice(fim + '</think>'.length);
  return t.replace(/<think>[\s\S]*$/i, '').trim();
}

export class IaLocal {
  /** @param {{ url?: string, modelo?: string, fetch?: Function, timeoutMs?: number }} opts */
  constructor(opts = {}) {
    this.url = (opts.url || process.env.OLLAMA_HOST_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
    this.modelo = opts.modelo || MODELO_PADRAO;
    this.fetch = opts.fetch || globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 90000;
  }

  async _req(path, body, timeoutMs = 5000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await this.fetch(this.url + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Ollama respondeu ${r.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /** { ligado, modelos[], modeloPronto } — nunca lança erro. */
  async status() {
    try {
      const d = await this._req('/api/tags', null, 2500);
      const modelos = (d.models || []).map((m) => m.name || m.model).filter(Boolean);
      const alvo = this.modelo.includes(':') ? this.modelo : this.modelo + ':latest';
      const pronto = modelos.includes(alvo);
      return { ligado: true, modelos, modelo: this.modelo, modeloPronto: pronto };
    } catch {
      return { ligado: false, modelos: [], modelo: this.modelo, modeloPronto: false };
    }
  }

  /**
   * Pergunta ao modelo local.
   * @returns {Promise<{ texto: string, ms: number, tokens: number }>}
   */
  async perguntar(prompt, { sistema = SISTEMA, maxTokens = 400, temperatura = 0.3 } = {}) {
    const t0 = Date.now();
    const d = await this._req('/api/chat', {
      model: this.modelo,
      stream: false,
      think: false,
      // "/no_think" é o comando do próprio Qwen3 para responder sem raciocínio (além de think:false)
      messages: [{ role: 'system', content: sistema + ' /no_think' }, { role: 'user', content: String(prompt) + ' /no_think' }],
      options: { num_predict: maxTokens, temperature: temperatura },
      keep_alive: '10m',
    }, this.timeoutMs);
    return { texto: limparResposta(d.message?.content), ms: Date.now() - t0, tokens: d.eval_count || 0 };
  }

  /** Baixa o modelo (pode levar minutos). onProgresso({status, completed, total}). */
  async baixar(onProgresso = () => {}) {
    const r = await this.fetch(this.url + '/api/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.modelo, stream: true }),
    });
    if (!r.ok || !r.body) throw new Error('Não consegui baixar o modelo (Ollama ligado?)');
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          const m = JSON.parse(line);
          if (m.error) throw new Error(m.error);
          onProgresso(m);
        } catch (e) { if (e.message && !/JSON/.test(e.message)) throw e; }
      }
    }
  }
}
