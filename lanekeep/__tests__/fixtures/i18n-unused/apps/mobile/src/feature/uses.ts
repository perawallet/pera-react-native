export const exact = 'used.exact'
export const templated = (kind: string) => `used.via_${kind}`
export const plural = 'used.plural'
export const parent = 'nested.child'
export const claimed = 'errors.claimed'
export const errorBase = 'errors.orphan'
// 'orphan.never' in a comment does not count
