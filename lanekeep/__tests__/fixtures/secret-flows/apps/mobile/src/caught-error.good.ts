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

export const reported = () => {
    try {
        run()
    } catch (error) {
        Sentry.captureException(error)
    }
}

export const recorded = () => {
    try {
        run()
    } catch (error) {
        crashlytics.recordError(error)
    }
}

export const tracked = () => {
    try {
        run()
    } catch (error) {
        analytics.logEvent('failed', { error })
    }
}

export const classified = () => {
    try {
        run()
    } catch {
        Sentry.captureMessage('request failed')
    }
}

export const reportedNonFatal = () => {
    try {
        run()
    } catch (error) {
        crashReporting.recordNonFatalError(error, { tags: { screen: 'send' } })
    }
}

export const recordedModular = () => {
    try {
        run()
    } catch (error) {
        crashlytics.recordError(crashlytics, error, 'send')
    }
}
