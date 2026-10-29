export const failed = async (data: Data) => {
    const result = await pair(data.uri, { origin })
    logger.error('connect failed', {
        error: result.error,
        ...describeUri(data.uri),
    })
}

export const redacted = (uri: string) => {
    logger.info('pairing', {
        ...walletConnectLogContext(uri),
        uri: redactWalletConnectUri(uri),
    })
}

export const topic = (uri: string) => {
    logger.debug('pairing', { topic: walletConnectUriTopic(uri) })
}

export const connected = async (data: Data) => {
    const result = await pairConnection(data.uri)
    logger.info('connected', { result })
}

export const described = (uri: string) => {
    logger.debug('pairing', { ...describeV2PairingUri(uri) })
}
