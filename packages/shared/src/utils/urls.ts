export const stripUrlScheme = (url?: string) => {
    if (!url) {
        return url
    }

    const index = url.indexOf('//')

    if (index >= 0) {
        return url.substring(index + 2)
    }
    return url
}
