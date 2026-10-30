export const build = (phrase: string, other: string, url?: string) => {
    const seed = seedFromMnemonic(phrase)
    logger.error('a', { matches: seed === other })
    logger.error('b', { length: seed.length })
    const stored = JSON.stringify(seed)
    logger.error('c', { origin: originOf(url ?? undefined) })
    logger.error('d', { d: describe(`${seed}`) })
    return stored
}
