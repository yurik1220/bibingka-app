// The backend stores each bundle size as its own row in `products`
// (e.g. "Classic Bibingka - 4 pcs", "Classic Bibingka - 6 pcs"), not as
// nested variants. This groups those rows back into one card per flavor
// with multiple bundle options, for display.
//
// Matches an optional space before "pcs"/"pc" so it works whether the
// product was named "4pcs" or "4 pcs" — the mobile app's ProductionScreen
// hit exactly this bug with a stricter regex, so this one is deliberately
// more forgiving.
const BUNDLE_SUFFIX = /\s*-\s*\d+\s*pcs?$/i;

export function groupProducts(products) {
  const groups = new Map();

  for (const product of products) {
    const flavor = product.name.replace(BUNDLE_SUFFIX, '').trim();
    const suffixMatch = product.name.match(/(\d+)\s*pcs?$/i);
    const bundleLabel = suffixMatch
      ? `${suffixMatch[1]} pc${suffixMatch[1] === '1' ? '' : 's'}`
      : product.name;

    if (!groups.has(flavor)) {
      groups.set(flavor, { flavor, variants: [] });
    }

    groups.get(flavor).variants.push({
      productId: product.id,
      label: bundleLabel,
      price: Number(product.price),
      pieces: Number(product.pieces_per_bundle) || 1,
      imageUrl: product.image_url,
    });
  }

  // Sort each flavor's variants smallest bundle first, for a predictable
  // "1 pc, 4 pcs, 6 pcs" reading order regardless of how they came back
  // from the database.
  for (const group of groups.values()) {
    group.variants.sort((a, b) => a.pieces - b.pieces);
  }

  return Array.from(groups.values());
}
