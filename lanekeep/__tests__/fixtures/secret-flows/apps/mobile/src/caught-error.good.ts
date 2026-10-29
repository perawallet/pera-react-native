export const logged = () => {
    try {
        run()
    } catch (error) {
        logger.error('failed', { error })
    }
}

export const chained = () => {
    try {
        run()
    } catch (error) {
        throw new Error('wrapped', { cause: error })
    }
}

export const serialize = (error: Error) => {
    return JSON.stringify(error)
}

export const snapshot = () => {
    const state = readState()
    logger.debug('state', { snapshot: JSON.stringify(state) })
}

export const onMessage = (e: WebViewMessageEvent) => {
    logger.debug('message', JSON.stringify(e.nativeEvent.data))
}
