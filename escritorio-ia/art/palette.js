// Paleta fechada do Escritório de IA Animado (estilo 16-bit, vista superior 3/4).
// Toda a arte é gerada por código a partir destas cores — nada fora daqui entra nos PNGs.
// Inclui as cores de destaque de shared/rooms.json (validado em art/validate.js).

export const PALETTE = {
  // neutros
  outline:   '#1a1420',
  ink:       '#2c2438',
  shadow:    '#4a4058',
  gray:      '#6e6a80',
  silver:    '#9a98a8',
  light:     '#c8c8d0',
  white:     '#f4f0e8',
  navy:      '#1e2a48',
  slate:     '#3a4a6a',
  // madeira / pisos / pele quente
  woodDark:  '#3e2a20',
  wood:      '#6a4630',
  woodLight: '#946440',
  tan:       '#c09060',
  cream:     '#e8dcc0',
  // pele
  skin:      '#f0c8a0',
  skinMid:   '#d09870',
  skinDark:  '#a06a48',
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
  tealDark:   '#406858',
  // luzes / brilhos
  lamp:       '#f8e080',
  neon:       '#c890f0',
  cyanLight:  '#a0e8f8',
  greenLight: '#a0f0a0',
  pinkLight:  '#f0a0c0',
  blueLight:  '#a0c0f8',
};

export const COLORS = Object.values(PALETTE);

/** Cor de destaque e sombra por id de sala (o valor do destaque vem de rooms.json). */
export const ACCENT_SHADE = {
  orquestrador: 'orangeDark', roteirista: 'yellowDark', 'editor-video': 'purpleDark',
  animador: 'cyanDark', programador: 'greenDark', desenvolvedor: 'blueDark',
  designer: 'pinkDark', revisor: 'redDark', copa: 'wood', lounge: 'tealDark',
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
