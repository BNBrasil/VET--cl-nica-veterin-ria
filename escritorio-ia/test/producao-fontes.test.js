// Testes de producao/fontes.js — sem rede, só amostras embutidas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analisarFeed, decodificarEntidades, textoLimpo, detectarRumor, deduplicar, ordenarPorData,
  analisarSteam, analisarEpic, formatarBRL, dominioOficial, temasDoTexto, coletar, semelhancaTitulos,
} from '../producao/fontes.js';

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Feed &amp; Teste</title><link>https://exemplo.com</link>
<item>
  <title><![CDATA[GTA 6: Rockstar confirma <b>novidade</b> & mais]]></title>
  <link>https://exemplo.com/gta6-novidade</link>
  <description><![CDATA[<img src="https://img.exemplo.com/a.jpg" /> <p>A Rockstar publicou &agrave; tarde uma not&iacute;cia.</p>]]></description>
  <pubDate>Thu, 26 Nov 2026 17:33:00 +0000</pubDate>
  <guid>https://exemplo.com/gta6-novidade</guid>
</item>
<item>
  <title>Promo&#231;&#227;o &quot;imperdível&quot; &#x2014; Steam</title>
  <link>https://exemplo.com/promo?utm=1</link>
  <description>&lt;p&gt;Desconto de 75%&lt;/p&gt;</description>
  <enclosure url="https://img.exemplo.com/b.jpg" type="image/jpeg" length="1"/>
  <pubDate>Wed, 25 Nov 2026 10:00:00 GMT</pubDate>
</item>
<item>
  <title>Vazou: suposto mapa de GTA 6 - Site X</title>
  <link>https://news.google.com/rss/articles/abc?oc=5</link>
  <description>&lt;a href="https://news.google.com/rss/articles/abc"&gt;Vazou: suposto mapa de GTA 6&lt;/a&gt;&amp;nbsp;&lt;font&gt;Site X&lt;/font&gt;</description>
  <source url="https://www.sitex.com.br">Site X</source>
  <media:content medium="image" url="https://img.exemplo.com/c.jpg"/>
  <pubDate>Thu, 26 Nov 2026 20:00:00 GMT</pubDate>
</item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Blog Oficial</title>
  <link href="https://oficial.exemplo.com/" rel="alternate"/>
  <entry>
    <title type="html">Lan&#231;amento &amp;amp; data</title>
    <link rel="self" href="https://oficial.exemplo.com/feed/1"/>
    <link rel="alternate" type="text/html" href="https://oficial.exemplo.com/post/1"/>
    <id>tag:oficial.exemplo.com,2026:1</id>
    <published>2026-11-20T12:00:00Z</published>
    <updated>2026-11-21T12:00:00Z</updated>
    <summary type="html">&lt;p&gt;Chega em &lt;b&gt;dezembro&lt;/b&gt;&lt;/p&gt;</summary>
  </entry>
  <entry>
    <title>Segundo post</title>
    <link href="https://oficial.exemplo.com/post/2"/>
    <updated>2026-11-22T08:00:00-03:00</updated>
    <content type="html"><![CDATA[<p>Texto com <img src='https://img.exemplo.com/d.png'> imagem</p>]]></content>
  </entry>
</feed>`;

test('entidades nomeadas, numéricas e hexadecimais', () => {
  assert.equal(decodificarEntidades('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#xE9; &atilde; &nbsp;'), 'a & b <c> "d" \'e\' é ã  ');
  assert.equal(decodificarEntidades('&naoexiste; &#99999999;'), '&naoexiste; &#99999999;');
  assert.equal(textoLimpo('<p>Ol&aacute;   <b>mundo</b></p>'), 'Olá mundo');
});

test('RSS: CDATA, entidades, imagem e data', () => {
  const f = analisarFeed(RSS);
  assert.equal(f.formato, 'rss');
  assert.equal(f.titulo, 'Feed & Teste');
  assert.equal(f.itens.length, 3);
  const [a, b, c] = f.itens;
  assert.equal(a.titulo, 'GTA 6: Rockstar confirma novidade & mais');
  assert.equal(a.url, 'https://exemplo.com/gta6-novidade');
  assert.equal(a.descricao, 'A Rockstar publicou à tarde uma notícia.');
  assert.equal(a.imagem, 'https://img.exemplo.com/a.jpg');
  assert.equal(a.publicadoEm, '2026-11-26T17:33:00.000Z');
  assert.equal(b.titulo, 'Promoção "imperdível" — Steam');
  assert.equal(b.descricao, 'Desconto de 75%');
  assert.equal(b.imagem, 'https://img.exemplo.com/b.jpg');
  // Google Notícias: tira " - Fonte" do título, guarda a origem e não repete o título na descrição
  assert.equal(c.titulo, 'Vazou: suposto mapa de GTA 6');
  assert.deepEqual(c.origem, { nome: 'Site X', url: 'https://www.sitex.com.br' });
  assert.equal(c.descricao, '');
  assert.equal(c.imagem, 'https://img.exemplo.com/c.jpg');
});

test('Atom: link alternate, published, summary e content com CDATA', () => {
  const f = analisarFeed(ATOM);
  assert.equal(f.formato, 'atom');
  assert.equal(f.titulo, 'Blog Oficial');
  assert.equal(f.itens.length, 2);
  assert.equal(f.itens[0].titulo, 'Lançamento & data');
  assert.equal(f.itens[0].url, 'https://oficial.exemplo.com/post/1');
  assert.equal(f.itens[0].publicadoEm, '2026-11-20T12:00:00.000Z');
  assert.equal(f.itens[0].descricao, 'Chega em dezembro');
  assert.equal(f.itens[1].url, 'https://oficial.exemplo.com/post/2');
  assert.equal(f.itens[1].publicadoEm, '2026-11-22T11:00:00.000Z');
  assert.equal(f.itens[1].imagem, 'https://img.exemplo.com/d.png');
});

test('feed inválido ou vazio não quebra', () => {
  assert.deepEqual(analisarFeed('').itens, []);
  assert.deepEqual(analisarFeed('<html><body>erro</body></html>').itens, []);
  assert.equal(analisarFeed('<rss><channel><item><title>Só título</title></item></channel></rss>').itens[0].url, null);
});

test('detecção de rumor', () => {
  assert.deepEqual(detectarRumor('Vazou: suposto mapa de GTA 6'), { rumor: true, palavras: ['vazou', 'suposto'] });
  assert.equal(detectarRumor('Segundo fontes, trailer sai amanhã').rumor, true);
  assert.equal(detectarRumor('Insider diz que...').rumor, true);
  assert.equal(detectarRumor('Novo LEAK de gameplay').rumor, true);
  assert.equal(detectarRumor('Rumores sobre o DLC').rumor, true);
  assert.equal(detectarRumor('Boato: GTA no Switch').rumor, true);
  assert.equal(detectarRumor('Rockstar confirma data oficial').rumor, false);
  // não casa pedaço de palavra
  assert.equal(detectarRumor('Bleak Faith ganha atualização').rumor, false);
  assert.equal(detectarRumor('Vazamento? Não, anúncio oficial', ['vazamento']).rumor, true);
});

test('temas por palavra-chave e domínio oficial', () => {
  const pal = { gta: ['gta', 'rockstar'], promocoes: ['desconto', 'grátis'] };
  assert.deepEqual(temasDoTexto('Rockstar dá desconto', pal), ['gta', 'promocoes']);
  assert.deepEqual(temasDoTexto('Jogo gratis hoje', pal), ['promocoes']);
  assert.equal(dominioOficial('https://www.rockstargames.com/newswire/article/1', ['rockstargames.com']), true);
  assert.equal(dominioOficial('https://rockstargames.com.golpe.net/x', ['rockstargames.com']), false);
  assert.equal(dominioOficial('lixo', ['rockstargames.com']), false);
});

test('deduplicação por URL, título e título quase igual; ordenação por data', () => {
  const itens = [
    { titulo: 'GTA 6 ganha trailer 3', url: 'https://a.com/x', fonte: 'A', publicadoEm: '2026-11-25T10:00:00Z' },
    { titulo: 'Outro assunto', url: 'https://www.a.com/x/', fonte: 'B', publicadoEm: '2026-11-25T11:00:00Z' },
    { titulo: 'GTA 6 GANHA TRAILER 3!', url: 'https://c.com/y', fonte: 'C', imagem: 'i.jpg', publicadoEm: '2026-11-25T12:00:00Z' },
    { titulo: 'Rockstar divulga trailer 3 de GTA 6 com Lucia', url: 'https://d.com/1', fonte: 'D', publicadoEm: '2026-11-26T09:00:00Z' },
    { titulo: 'Rockstar divulga trailer 3 de GTA 6 com Lucia e Jason', url: 'https://e.com/2', fonte: 'E', oficial: true, publicadoEm: '2026-11-26T08:00:00Z' },
    { titulo: 'Sem data', url: 'https://f.com/z', fonte: 'F' },
  ];
  const d = deduplicar(itens);
  assert.equal(d.length, 3);
  assert.deepEqual(d[0].tambemEm, ['B', 'C']);
  assert.equal(d[0].imagem, 'i.jpg');
  assert.deepEqual(d[1].tambemEm, ['E']);
  assert.equal(d[1].oficial, true);
  assert.ok(semelhancaTitulos('a b', 'a b') === 0, 'títulos curtos não são comparados por semelhança');
  const o = ordenarPorData(d);
  assert.deepEqual(o.map((x) => x.fonte), ['D', 'A', 'F']);
});

test('formatarBRL', () => {
  assert.equal(formatarBRL(7497), 'R$ 74,97');
  assert.equal(formatarBRL(123456), 'R$ 1.234,56');
  assert.equal(formatarBRL(0), 'R$ 0,00');
  assert.equal(formatarBRL(undefined), null);
});

const AGORA = Date.parse('2026-11-26T22:00:00Z');

const STEAM = {
  specials: { id: 'cat_specials', name: 'Ofertas', items: [
    { id: 1174180, type: 0, name: 'Red Dead Redemption 2', discounted: true, discount_percent: 75,
      original_price: 29990, final_price: 7497, currency: 'BRL', discount_expiration: 1796666400,
      header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/header.jpg' },
    { id: 55, type: 1, name: 'Pacote X', discounted: true, discount_percent: 40,
      original_price: 10000, final_price: 6000, currency: 'BRL', discount_expiration: 1796500000,
      large_capsule_image: 'https://exemplo/cap.jpg' },
  ] },
  top_sellers: { id: 'cat_topsellers', name: 'Mais vendidos', items: [
    { id: 1174180, type: 0, name: 'Red Dead Redemption 2', discounted: true, discount_percent: 75,
      original_price: 29990, final_price: 7497, currency: 'BRL', discount_expiration: 1796666400 },
    { id: 730, type: 0, name: 'Counter-Strike 2', discounted: false, discount_percent: 0, original_price: 0, final_price: 0, currency: 'BRL' },
  ] },
  new_releases: { id: 'cat_newreleases', name: 'Novidades', items: [
    { id: 999, type: 0, name: 'Jogo Novo', discounted: false, discount_percent: 0, final_price: 4999, header_image: 'h.jpg' },
  ] },
  coming_soon: { id: 'cat_comingsoon', name: 'Em breve', items: [
    { id: 1000, type: 0, name: 'Jogo Futuro', discounted: false, discount_percent: 0, header_image: 'f.jpg' },
    { id: 999, type: 0, name: 'Jogo Novo' },
  ] },
};

test('Steam: promoções em BRL, fim da promoção, capa e lançamentos', () => {
  const s = analisarSteam(STEAM, { agora: AGORA });
  assert.equal(s.promocoes.length, 2);
  const rdr = s.promocoes[0];
  assert.equal(rdr.nome, 'Red Dead Redemption 2');
  assert.equal(rdr.de, 'R$ 299,90');
  assert.equal(rdr.por, 'R$ 74,97');
  assert.equal(rdr.desconto, 75);
  assert.equal(rdr.terminaEm, new Date(1796666400 * 1000).toISOString());
  assert.ok(rdr.horasRestantes > 6);
  assert.equal(rdr.url, 'https://store.steampowered.com/app/1174180/');
  assert.match(rdr.imagem, /header\.jpg$/);
  assert.equal(rdr.imagemUsoLivre, true);
  assert.equal(rdr.oficial, true);
  assert.deepEqual(rdr.listas, ['specials', 'top_sellers']);
  assert.equal(s.promocoes[1].url, 'https://store.steampowered.com/sub/55/');
  assert.equal(s.promocoes[1].imagem, 'https://exemplo/cap.jpg');
  assert.deepEqual(s.lancamentos.map((l) => [l.nome, l.estado]), [['Jogo Novo', 'novo'], ['Jogo Futuro', 'em-breve']]);
  assert.deepEqual(analisarSteam({}), { promocoes: [], lancamentos: [] });
});

const EPIC = { data: { Catalog: { searchStore: { elements: [
  { title: 'Jogo Pago', id: 'p1', promotions: null, price: { totalPrice: { discountPrice: 3799, originalPrice: 3799 } }, keyImages: [] },
  { title: 'Bread and Fred', id: 'g1', productSlug: null, urlSlug: 'x',
    catalogNs: { mappings: [{ pageSlug: 'bread-and-fred-1db362', pageType: 'productHome' }] },
    keyImages: [{ type: 'Thumbnail', url: 'https://cdn/thumb.jpg' }, { type: 'OfferImageWide', url: 'https://cdn/wide.jpg' }],
    price: { totalPrice: { discountPrice: 0, originalPrice: 3999 } },
    promotions: {
      promotionalOffers: [{ promotionalOffers: [{ startDate: '2026-11-26T16:00:00.000Z', endDate: '2026-12-03T16:00:00.000Z', discountSetting: { discountType: 'PERCENTAGE', discountPercentage: 0 } }] }],
      upcomingPromotionalOffers: [{ promotionalOffers: [{ startDate: '2026-12-10T16:00:00.000Z', endDate: '2027-01-07T16:00:00.000Z', discountSetting: { discountType: 'PERCENTAGE', discountPercentage: 40 } }] }],
    } },
  { title: 'Strange Antiquities', id: 'g2', productSlug: 'strange-antiquities/home',
    keyImages: [{ type: 'OfferImageTall', url: 'https://cdn/tall.jpg' }],
    price: { totalPrice: { discountPrice: 4699, originalPrice: 4699 } },
    promotions: { promotionalOffers: [], upcomingPromotionalOffers: [{ promotionalOffers: [{ startDate: '2026-12-03T16:00:00.000Z', endDate: '2026-12-10T16:00:00.000Z', discountSetting: { discountType: 'PERCENTAGE', discountPercentage: 0 } }] }] } },
  { title: 'TerraScape', id: 'd1', price: { totalPrice: { discountPrice: 3149, originalPrice: 4499 } },
    promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: '2026-11-21T16:00:00.000Z', endDate: '2026-12-21T16:00:00.000Z', discountSetting: { discountType: 'PERCENTAGE', discountPercentage: 70 } }] }], upcomingPromotionalOffers: [] } },
  { title: 'Já acabou', id: 'g3', price: { totalPrice: { discountPrice: 0, originalPrice: 1000 } },
    promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: '2026-11-19T16:00:00.000Z', endDate: '2026-11-26T16:00:00.000Z', discountSetting: { discountPercentage: 0 } }] }] } },
] } } } };

test('Epic: só grátis promocionais ativos e próximos, com datas', () => {
  const g = analisarEpic(EPIC, { agora: AGORA });
  assert.deepEqual(g.map((x) => [x.nome, x.estado]), [['Bread and Fred', 'ativo'], ['Strange Antiquities', 'proximo']]);
  const [a, p] = g;
  assert.equal(a.inicio, '2026-11-26T16:00:00.000Z');
  assert.equal(a.terminaEm, '2026-12-03T16:00:00.000Z');
  assert.equal(a.url, 'https://store.epicgames.com/pt-BR/p/bread-and-fred-1db362');
  assert.equal(a.imagem, 'https://cdn/wide.jpg');
  assert.equal(a.precoOriginal, 'R$ 39,99');
  assert.equal(a.oficial, true);
  assert.equal(a.imagemUsoLivre, true);
  assert.ok(a.horasRestantes > 100);
  assert.equal(p.url, 'https://store.epicgames.com/pt-BR/p/strange-antiquities');
  assert.equal(p.horasRestantes, null);
  assert.deepEqual(analisarEpic({}), []);
});

test('coletar: erro em uma fonte não derruba as outras; imagem de notícia não é de uso livre', async () => {
  const config = {
    fontes: [
      { id: 'steam', nome: 'Steam', tipo: 'steam', url: 'https://steam/x', temas: ['promocoes'], oficial: true },
      { id: 'epic', nome: 'Epic', tipo: 'epic', url: 'https://epic/x', temas: ['promocoes'], oficial: true },
      { id: 'rss1', nome: 'Feed 1', tipo: 'rss', url: 'https://feed1/x', temas: ['gta'], oficial: false },
      { id: 'quebrada', nome: 'Quebrada', tipo: 'rss', url: 'https://quebrada/x', temas: ['gta'] },
      { id: 'gn', nome: 'GN', tipo: 'rss', busca: 'GTA 6', url: 'https://gn/?q={termo}', temas: ['gta'] },
      { id: 'off', nome: 'Desligada', tipo: 'rss', url: 'https://off/x', temas: ['gta'], ativo: false },
    ],
    dominiosOficiais: ['rockstargames.com'],
    palavrasTema: { gta: ['gta', 'rockstar'] },
    maxDiasNoticia: 7,
  };
  const pedidos = [];
  const buscar = async (url) => {
    pedidos.push(url);
    if (url.startsWith('https://steam')) return JSON.stringify(STEAM);
    if (url.startsWith('https://epic')) return JSON.stringify(EPIC);
    if (url.startsWith('https://feed1')) return RSS;
    if (url.startsWith('https://gn')) {
      return `<rss><channel><item><title>Rockstar anuncia evento - Rockstar Games</title><link>https://news.google.com/a</link>
        <source url="https://www.rockstargames.com">Rockstar Games</source><pubDate>Thu, 26 Nov 2026 21:00:00 GMT</pubDate></item>
        <item><title>GTA antigo</title><link>https://x/antigo</link><pubDate>Thu, 01 Jan 2015 00:00:00 GMT</pubDate></item></channel></rss>`;
    }
    throw new Error('HTTP 500');
  };
  const r = await coletar({ tema: 'tudo', config, agora: AGORA, buscar });
  assert.ok(pedidos.includes('https://gn/?q=GTA%206'));
  assert.ok(!pedidos.some((u) => u.startsWith('https://off')));
  assert.equal(r.erros.length, 1);
  assert.equal(r.erros[0].fonte, 'Quebrada');
  assert.equal(r.promocoes.length, 2);
  assert.equal(r.gratis.length, 2);
  assert.equal(r.noticias.length, 4, 'promo sem tema gta entra em "tudo"; notícia de 2015 fica de fora');
  assert.equal(r.noticias[0].titulo, 'Rockstar anuncia evento');
  assert.equal(r.noticias[0].oficial, true);
  for (const n of r.noticias) assert.equal(n.imagemUsoLivre, false);
  const vazou = r.noticias.find((n) => n.titulo.startsWith('Vazou'));
  assert.equal(vazou.rumor, true);
  assert.equal(vazou.fonte, 'Site X');

  const soGta = await coletar({ tema: 'gta', config, agora: AGORA, buscar });
  assert.equal(soGta.promocoes.length, 0);
  assert.ok(soGta.noticias.every((n) => n.temas.includes('gta')));
  assert.equal(soGta.noticias.length, 3);
});
