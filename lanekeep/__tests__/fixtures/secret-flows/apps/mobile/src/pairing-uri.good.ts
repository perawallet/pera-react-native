export const redacted = (uri: string) => {
    logger.info('pairing', {
        ...walletConnectLogContext(uri),
        uri: redactWalletConnectUri(uri),
    })
}

export const topic = (uri: string) => {
    logger.debug('pairing', { topic: walletConnectUriTopic(uri) })
}

export const described = (uri: string) => {
    logger.debug('pairing', { ...describeV2PairingUri(uri) })
}

export const failed = (data: Data) => {
    logger.error('connect failed', { ...describeUri(data.uri) })
}
