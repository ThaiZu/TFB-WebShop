const normalize = value => String(value ?? '').toLowerCase().normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length < b.length) return oneEdit(b, a);
  let i = 0;
  while (i < b.length && a[i] === b[i]) i++;
  if (a.length > b.length) return a.slice(i + 1) === b.slice(i);
  return a.slice(i + 1) === b.slice(i + 1)
    || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}

export function searchProducts(products, query, categoryName = product => product.cat) {
  const phrase = normalize(query);
  if (!phrase) return products;
  const terms = phrase.split(' ');
  return products.flatMap(product => {
    const name = normalize(product.name);
    const words = name.split(' ');
    const categories = normalize(categoryName(product)).split(' ');
    const scores = terms.map(term => {
      if (words.includes(term)) return 8;
      if (words.some(word => word.startsWith(term))) return 6;
      if (categories.some(word => word.startsWith(term))) return 3;
      if (term.length >= 4 && words.some(word => oneEdit(term, word))) return 1;
      return 0;
    });
    if (scores.includes(0)) return [];
    const phraseBonus = name === phrase ? 100 : name.startsWith(phrase) ? 30 : 0;
    return [{product, score: phraseBonus + scores.reduce((sum, score) => sum + score, 0)}];
  }).sort((a, b) => b.score - a.score).map(result => result.product);
}
