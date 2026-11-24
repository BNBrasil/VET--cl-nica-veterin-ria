// Paleta fechada do Escritório de IA Animado — v2 (pixel art isométrica, cores vivas, contorno escuro).
// Toda a arte é gerada por código a partir destas cores — nada fora daqui entra nos PNGs.
// Inclui as cores de destaque de shared/rooms.json (validado em art/generate.js e art/validate.js).
// Cada destaque tem três tons: escuro (sombra/face lateral), médio (o destaque) e claro (luz/parede).

export const PALETTE = {
  // neutros (frios, levemente arroxeados)
  outline:   '#1a1420',
  ink:       '#2c2438',
  shadow:    '#4a4058',
  gray:      '#6e6a80',
  silver:    '#9a98a8',
  light:     '#c8c8d0',
  white:     '#f4f0e8',
  snow:      '#ffffff',
  navy:      '#1e2a48',
  slate:     '#3a4a6a',
  steel:     '#5a6a8a',
  // madeira / pisos / tons quentes
  woodDark:  '#3e2a20',
  wood:      '#6a4630',
  woodLight: '#946440',
  tan:       '#c09060',
  sand:      '#dcb888',
  cream:     '#e8dcc0',
  // pele
  skin:      '#f0c8a0',
  skinMid:   '#d09870',
  skinDark:  '#a06a48',
  skinDeep:  '#7a4a30',
  blush:     '#f08080',
  // cabelo
  ginger:    '#c06030',
  blonde:    '#e8c860',
  // destaques das salas (shared/rooms.json)
  orange:    '#e0a030', // orquestrador
  yellow:    '#d8c040', // roteirista
  purple:    '#9a4ad8', // editor-video
  cyan:      '#40b0d0', // animador
  green:     '#40c060', // programador
  blue:      '#4070e0', // desenvolvedor
  pink:      '#e05090', // designer
  red:       '#c04040', // revisor
  brown:     '#a07050', // copa
  teal:      '#70a090', // lounge
  // sombras dos destaques
  orangeDark: '#a06a18',
  yellowDark: '#988420',
  purpleDark: '#5a2a90',
  cyanDark:   '#20708a',
  greenDark:  '#207a38',
  blueDark:   '#2a4498',
  pinkDark:   '#982a60',
  redDark:    '#7a2028',
  brownDark:  '#70482e',
  tealDark:   '#406858',
  // luzes dos destaques (paredes, brilhos)
  orangeLight: '#f8d088',
  lamp:        '#f8e880',
  neon:        '#c890f0',
  cyanLight:   '#a0e8f8',
  greenLight:  '#a0f0a0',
  blueLight:   '#a0c0f8',
  pinkLight:   '#f0a0c0',
  redLight:    '#f0a090',
  brownLight:  '#d8b090',
  tealLight:   '#b0d8c8',
  // tons pastel para paredes (claros e pouco saturados)
  orangePale:  '#fbe8c8',
  yellowPale:  '#f8f0c0',
  purplePale:  '#3a2458',
  cyanPale:    '#d0f0f8',
  greenPale:   '#28384a',
  bluePale:    '#d8e4fc',
  pinkPale:    '#fcdce8',
  redPale:     '#fcf4f0',
  tealPale:    '#d8ece4',
};

export const COLORS = Object.values(PALETTE);

/** Cor de destaque e sombra por id de sala (o valor do destaque vem de rooms.json). */
export const ACCENT = {
  orquestrador: { mid: 'orange', dark: 'orangeDark', light: 'orangeLight', pale: 'orangePale' },
  roteirista: { mid: 'yellow', dark: 'yellowDark', light: 'lamp', pale: 'yellowPale' },
  'editor-video': { mid: 'purple', dark: 'purpleDark', light: 'neon', pale: 'purplePale' },
  animador: { mid: 'cyan', dark: 'cyanDark', light: 'cyanLight', pale: 'cyanPale' },
  programador: { mid: 'green', dark: 'greenDark', light: 'greenLight', pale: 'greenPale' },
  desenvolvedor: { mid: 'blue', dark: 'blueDark', light: 'blueLight', pale: 'bluePale' },
  designer: { mid: 'pink', dark: 'pinkDark', light: 'pinkLight', pale: 'pinkPale' },
  revisor: { mid: 'red', dark: 'redDark', light: 'redLight', pale: 'redPale' },
  copa: { mid: 'brown', dark: 'brownDark', light: 'brownLight', pale: 'cream' },
  lounge: { mid: 'teal', dark: 'tealDark', light: 'tealLight', pale: 'tealPale' },
};

export function hexToRgba(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
}

/** Nome da cor na paleta a partir do hex (ou undefined). */
export function nameOf(hex) {
  const lc = hex.toLowerCase();
  return Object.keys(PALETTE).find((k) => PALETTE[k] === lc);
}
