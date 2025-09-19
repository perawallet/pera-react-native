import { toByteArray, fromByteArray } from 'base64-js'

export const encodeToBase64 = (bytes: Uint8Array) => {
    return fromByteArray(bytes)
}

export const decodeFromBase64 = (base64: string) => {
    return toByteArray(base64)
}

export const asFixedPrecisionNumber = (value: string, precision: number) => {
    const input = value.trim()

    if (!input.length || input === '-' || input === '+') {
        return precision > 0 ? `0.${''.padEnd(precision, '0')}` : '0'
    }

    let sign = ''
    let s = input
    if (s[0] === '+' || s[0] === '-') {
        sign = s[0]
        s = s.slice(1)
    }

    const parts = s.split('.')
    if (parts.length > 2) {
        // Invalid numeric format; preserve original
        return value
    }

    let integerPart = parts[0] || '0'
    let fractionPart = parts[1] || ''

    // Validate digits only (no scientific notation / separators)
    const digitsOnly = /^[0-9]*$/
    if (!digitsOnly.test(integerPart) || !digitsOnly.test(fractionPart)) {
        return value
    }

    const clampedPrecision = Math.max(0, precision | 0)
    if (clampedPrecision === 0) {
        if (fractionPart[0] && Number(fractionPart[0]) >= 5) {
            integerPart =  (Number(integerPart) + 1).toString()
        }
        return `${sign}${integerPart}`
    }

    if (fractionPart.length < clampedPrecision) {
        return `${sign}${integerPart}.${fractionPart.padEnd(clampedPrecision, '0')}`
    }

    if (fractionPart.length === clampedPrecision) {
        return `${sign}${integerPart}.${fractionPart}`
    }

    //we have too many fraction digits so we need to round
    const keep = fractionPart.slice(0, clampedPrecision)
    const roundingDigit = fractionPart[clampedPrecision]
    if (Number(roundingDigit) < 5) {
        return `${sign}${integerPart}.${keep}`
    }

    const incremented = (parseInt(keep, 10) + 1).toString()

    if (incremented.length > clampedPrecision) {
        integerPart = (Number(integerPart) + 1).toString()
        return `${sign}${integerPart}.${''.padEnd(clampedPrecision, '0')}`
    }

    return `${sign}${integerPart}.${incremented.padStart(clampedPrecision, '0')}`
}
