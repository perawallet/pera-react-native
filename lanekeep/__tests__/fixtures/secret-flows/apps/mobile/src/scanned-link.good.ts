export const parsed = (url: string) => {
    logger.debug('parsed', { type: parseDeeplink(url)?.type })
}

export const warm = () => {
    Linking.addEventListener('url', event => {
        logger.debug('warm', { url: redactSensitiveUrl(event.url) })
    })
}

export const unknownMethod = (security: Security) => {
    const sourceOrigin = originOf(security.sourceUrl ?? undefined)
    trackEvent('method_not_found', {
        ...(sourceOrigin ? { url: sourceOrigin } : {}),
    })
}
