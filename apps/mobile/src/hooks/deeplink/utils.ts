
/**
 * Parse query parameters from a URL
 */
export const parseQueryParams = (url: string): Record<string, string> => {
    const params: Record<string, string> = {}

    try {
        const urlObj = new URL(url.replace(/^([a-z-]+):\/\/(?!\/)/, '$1://placeholder/'))
        urlObj.searchParams.forEach((value, key) => {
            params[key] = decodeURIComponent(value)
        })
    } catch {
        // Fallback for malformed URLs
        const queryStart = url.indexOf('?')
        if (queryStart === -1) return params

        const queryString = url.slice(queryStart + 1)
        queryString.split('&').forEach((pair) => {
            const [key, value] = pair.split('=')
            if (key) {
                params[key] = value ? decodeURIComponent(value) : ''
            }
        })
    }

    return params
}

/**
 * Decode base64-encoded parameter
 */
export const decodeBase64Param = (param: string): string => {
    try {
        return Buffer.from(param, 'base64').toString('utf-8')
    } catch {
        return param
    }
}

/**
 * Normalize URL by trimming and lowercasing only the scheme part
 * Preserves case in the rest of the URL (important for addresses)
 */
export const normalizeUrl = (url: string): string => {
    const trimmed = url.trim()
    const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/)
    if (schemeMatch) {
        return schemeMatch[1].toLowerCase() + ':' + schemeMatch[2]
    }
    return trimmed.toLowerCase()
}

export const extractPath = (url: string): string => {
    try {
        const appIndex = url.indexOf('/app/')
        if (appIndex !== -1) {
            const pathStart = appIndex + 5 // length of '/app/'
            const queryIndex = url.indexOf('?', pathStart)
            return queryIndex !== -1 ? url.slice(pathStart, queryIndex) : url.slice(pathStart)
        }
        return ''
    } catch {
        return ''
    }
}