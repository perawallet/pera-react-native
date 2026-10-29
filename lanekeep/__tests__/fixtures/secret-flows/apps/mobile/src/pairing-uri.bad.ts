export const failed = (data: Data, result: Result) => {
    logger.error('connect failed', { error: result.error, uri: data.uri })
}

export const rejected = (uri: string) => logger.warn('pair failed', { uri })

export const tracked = (message: Message) => {
    trackEvent('pair', { uri: message.params.uri })
}

export const wrapped = (uri: string) => {
    throw new Error(`cannot pair ${uri}`)
}

export const derived = (url: string) => {
    const wcUri = walletConnectUriOf(url)
    console.log(wcUri)
}
