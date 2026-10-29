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
