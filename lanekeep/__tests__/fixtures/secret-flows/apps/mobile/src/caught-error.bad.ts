export const caught = () => {
    try {
        run()
    } catch (error) {
        logger.error('failed', { details: JSON.stringify(error) })
    }
}

export const beforeError = ({ request, error }: BeforeErrorState) =>
    logger.error('request failed', { details: JSON.stringify(error, replacer) })

export const chained = (promise: Promise<void>) =>
    promise.catch(err => trackEvent('failed', { details: JSON.stringify(err) }))

export const wrapped = () => {
    try {
        run()
    } catch (error) {
        throw new Error(`wrapped: ${JSON.stringify(error)}`)
    }
}

export const response = (deliveryError: Error) =>
    logger.warn('x', { r: JSON.stringify(deliveryError.response) })

export const bareCatch = () => {
    try {
        run()
    } catch (e) {
        logger.error('failed', { details: JSON.stringify(e) })
    }
}

export const caughtMember = () => {
    try {
        run()
    } catch (e) {
        logger.error('failed', { details: JSON.stringify(e.response) })
    }
}

export const reported = () => {
    try {
        run()
    } catch (error) {
        Sentry.captureException(JSON.stringify(error))
    }
}

export const recorded = () => {
    try {
        run()
    } catch (error) {
        crashlytics.recordError(JSON.stringify(error))
    }
}

export const tracked = () => {
    try {
        run()
    } catch (error) {
        analytics.logEvent('failed', { details: JSON.stringify(error) })
    }
}
