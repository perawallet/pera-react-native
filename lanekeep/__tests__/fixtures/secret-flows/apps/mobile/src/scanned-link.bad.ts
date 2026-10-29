export const scanned = (barcodes: Barcode[]) => {
    const url = barcodes.at(0)?.rawValue
    logger.debug('scanned', { url })
}

export const cold = async () => {
    const initial = await Linking.getInitialURL()
    logger.debug('cold start', { initial })
}

export const warm = () => {
    Linking.addEventListener('url', event =>
        logger.debug('warm', { url: event.url }),
    )
}

export const failedOpen = (error: Error, parsedData: Parsed) => {
    logger.error('open failed', { error, url: parsedData.sourceUrl })
}

export const parseDeeplink = (url: string) => {
    logger.debug('parsing', { url })
    return url
}
