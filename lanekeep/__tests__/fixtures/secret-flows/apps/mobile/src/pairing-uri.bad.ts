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

export const optional = (uri?: string) => {
    logger.debug('pair', { uri })
}

export const bare = (queue: string[]) => {
    queue.forEach(uri => logger.debug('pair', { uri }))
}

export const paired = async (data: Data) => {
    const result = await pair(data.uri, { origin })
    logger.error('connect failed', { error: result.error })
}

export const connected = async (data: Data) => {
    const result = await pairConnection(data.uri)
    logger.info('connected', { result })
}
