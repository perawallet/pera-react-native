import { toByteArray, fromByteArray } from 'base64-js'

export const encodeToBase64 = (bytes: Uint8Array) => {
    return fromByteArray(bytes)
}

export const decodeFromBase64 = (base64: string) => {
    return toByteArray(base64)
}

export const asFixedPrecisionNumber = (value: string, precision: number) => {
    const parts = value.split('.')

    if (parts.length > 2) {
        return value
    }

    let beforeDot = parts[0]
    if (!beforeDot.length) {
        beforeDot = beforeDot.padEnd(1, '0')
    }

    if (precision === 0) {
        return beforeDot
    }

    if (parts.length === 1) {
        return `${beforeDot}.${''.padEnd(precision, '0')}`
    }

    let afterDot = parts[1]
    if (afterDot.length > precision) {
        //we truncate one extra for rounding purposes
        afterDot = afterDot.substring(0, precision + 1)
        const num = (Number(afterDot) / 10) ^ precision
        afterDot = Math.round(num).toString()
    }

    return `${beforeDot}.${afterDot.padEnd(precision, '0')}`
}
