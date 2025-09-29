import { toByteArray, fromByteArray } from 'base64-js'
import { Decimal } from 'decimal.js'

Decimal.set({ precision: 18, crypto: true, rounding: Decimal.ROUND_HALF_UP })

export const encodeToBase64 = (bytes: Uint8Array) => {
    return fromByteArray(bytes)
}

export const decodeFromBase64 = (base64: string) => {
    return toByteArray(base64)
}

//TODO: we should fetch this from the server or a file or something
const currencySymbols: Record<string, string> = {
    ETH: 'Ξ',
    BTC: '₿',
    USD: '$',
    EUR: '€',
    GBP: '£',
}

export const formatCurrency = (
    value: Decimal | string | number,
    precision: number,
    currency: string,
    locale: string = 'en-US',
) => {
    const decimal = new Decimal(value).toFixed(precision)
    const currencySymbol = currency === 'ALGO' ? '' : 
        currencySymbols[currency] ?? '$'

    const parts = decimal.split('.')
    const integer = parts[0]
    const formatter = Intl.NumberFormat(locale, {
        style: 'decimal',
    })
    let formattedInteger = formatter.format(Number(integer))
    const fraction = parts.length > 1 ? '.' + parts[1] : ''

    let sign = ''
    if (formattedInteger.startsWith('-') || formattedInteger.startsWith('+')) {
        sign = formattedInteger[0]
        formattedInteger = formattedInteger.substring(1)
    }

    //TODO this is pretty limited formatting - it's not very locale specific
    return `${sign}${currencySymbol}${formattedInteger}${fraction}`
}
