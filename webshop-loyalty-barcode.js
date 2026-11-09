/*!
Code 128 symbol table from JsBarcode v3.11.6:
https://github.com/lindell/JsBarcode/blob/v3.11.6/src/barcodes/CODE128/constants.js
Copyright (c) 2016 Johan Lindell (johan@lindell.me). MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const SYMBOLS = '11011001100 11001101100 11001100110 10010011000 10010001100 10001001100 10011001000 10011000100 10001100100 11001001000 11001000100 11000100100 10110011100 10011011100 10011001110 10111001100 10011101100 10011100110 11001110010 11001011100 11001001110 11011100100 11001110100 11101101110 11101001100 11100101100 11100100110 11101100100 11100110100 11100110010 11011011000 11011000110 11000110110 10100011000 10001011000 10001000110 10110001000 10001101000 10001100010 11010001000 11000101000 11000100010 10110111000 10110001110 10001101110 10111011000 10111000110 10001110110 11101110110 11010001110 11000101110 11011101000 11011100010 11011101110 11101011000 11101000110 11100010110 11101101000 11101100010 11100011010 11101111010 11001000010 11110001010 10100110000 10100001100 10010110000 10010000110 10000101100 10000100110 10110010000 10110000100 10011010000 10011000010 10000110100 10000110010 11000010010 11001010000 11110111010 11000010100 10001111010 10100111100 10010111100 10010011110 10111100100 10011110100 10011110010 11110100100 11110010100 11110010010 11011011110 11011110110 11110110110 10101111000 10100011110 10001011110 10111101000 10111100010 11110101000 11110100010 10111011110 10111101110 11101011110 11110101110 11010000100 11010010000 11010011100 1100011101011'.split(' ');

// Numeric cards use set C (two digits per symbol); signed legacy cards use B.
export function isShortLoyaltyCardCode(code) {
  return typeof code === 'string' && /^98[0-9]{14}$/.test(code) && code.length === 16;
}

export function isLoyaltyCardCode(code) {
  return isShortLoyaltyCardCode(code) || (typeof code === 'string' && /^FID1-[0-9A-Z]{1,6}-[0-9A-F]{32}$/.test(code) && !code.includes('\n'));
}

export function encodeLoyaltyBarcode(code) {
  if (!isLoyaltyCardCode(code)) throw new TypeError('Invalid loyalty identity');
  const short = isShortLoyaltyCardCode(code);
  const start = short ? 105 : 104;
  const values = short ? code.match(/../g).map(Number) : Array.from(code, character => character.charCodeAt(0) - 32);
  const checksum = values.reduce((sum, value, index) => sum + value * (index + 1), start) % 103;
  return [start, ...values, checksum, 106].map(value => SYMBOLS[value]).join('');
}

export function renderLoyaltyBarcode(code) {
  const bits = encodeLoyaltyBarcode(code);
  const width = bits.length + 20; // At least 10 blank modules on either side.
  const bars = Array.from(bits.matchAll(/1+/g), match =>
    `<rect x="${10 + match.index}" y="8" width="${match[0].length}" height="96"/>`).join('');
  // Only numeric geometry is interpolated; never include the raw identity in HTML.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 112" width="${width * 2}" height="224" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"><rect width="${width}" height="112" fill="#fff"/><g fill="#000">${bars}</g></svg>`;
}
