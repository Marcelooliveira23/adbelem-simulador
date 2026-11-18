/* Código de barras Code 128 (conjunto B) em SVG, sem bibliotecas externas. Usado nas etiquetas de patrimônio.
   codigoBarrasSVG('P-0001', { altura: 40 }) -> '<svg ...>' */
const CODE128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
  '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 ' +
  '131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 ' +
  '213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
  '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 ' +
  '421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232').split(' ');
const CODE128_STOP = '2331112';

/** Padrão de larguras -> bits ("212222" -> "11011001100"). */
function code128Bits(larguras) {
  return [...larguras].map((w, i) => (i % 2 ? '0' : '1').repeat(Number(w))).join('');
}

function codigoBarrasSVG(texto, { altura = 40, modulo = 2 } = {}) {
  const t = String(texto).replace(/[^\x20-\x7E]/g, '?');       // Code 128-B: caracteres ASCII imprimíveis
  const valores = [104, ...[...t].map(c => c.charCodeAt(0) - 32)];
  const soma = valores.reduce((s, v, i) => s + v * (i || 1), 0);
  const bits = '0'.repeat(10) + [...valores, soma % 103].map(v => code128Bits(CODE128[v])).join('') + code128Bits(CODE128_STOP) + '0'.repeat(10);
  let x = 0, barras = '';
  for (const m of bits.matchAll(/1+|0+/g)) {
    if (m[0][0] === '1') barras += `<rect x="${x * modulo}" y="0" width="${m[0].length * modulo}" height="${altura}"/>`;
    x += m[0].length;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x * modulo} ${altura}" width="100%" height="${altura}" preserveAspectRatio="none"
    role="img" aria-label="Código de barras ${t.replace(/"/g, '')}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${barras}</g></svg>`;
}
if (typeof module !== 'undefined') module.exports = { CODE128, CODE128_STOP, code128Bits, codigoBarrasSVG };
