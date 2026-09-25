export const leak = (phrase: string, account: Account) => {
    const seed = seedFromMnemonic(phrase)
    const entropy = kms.mnemonicToEntropy(phrase)
    logger.error('import failed', seed)
    console.log(entropy)
    analytics.logEvent('import', { seed })
    logger.warn('signing with', account.privateKey)
    throw new Error(`bad seed ${seed}`)
}

export const safe = (phrase: string) => {
    const seed = seedFromMnemonic(phrase)
    logger.info('imported')
    return seed
}
