/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { toByteArray, fromByteArray } from 'base64-js'
import { Decimal } from './decimal-config'
import { logger } from './logging'
import { isAlgoAssetName } from './algo'

export const encodeToBase64 = (bytes: Uint8Array) => {
    return fromByteArray(bytes)
}

export const decodeFromBase64 = (base64: string): Uint8Array => {
    return toByteArray(base64)
}

/**
 * Converts a standard base64 string to url-safe base64 (RFC 4648 §5, no
 * padding): `+` → `-`, `/` → `_`, trailing `=` removed.
 */
export const toUrlSafeBase64 = (b64: string): string => {
    // Strip trailing '=' padding with a linear scan rather than a regex:
    // /=+$/ backtracks polynomially on long runs of '=' (ReDoS).
    let end = b64.length
    while (end > 0 && b64.charCodeAt(end - 1) === 0x3d /* '=' */) end--
    return b64.slice(0, end).replace(/\+/g, '-').replace(/\//g, '_')
}

export const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes
}

export const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

/**
 * UTF-8 byte length of a string (not its `.length`, which counts UTF-16 code
 * units). Use for size caps on untrusted payloads, where the on-the-wire byte
 * count is what matters.
 */
export const utf8ByteLength = (value: string): number =>
    new TextEncoder().encode(value).length

/**
 * Decode a value that may be a JS number, a string-encoded number, or null.
 *
 * Used at FFI / native-bridge boundaries where 64-bit integers are serialized
 * as strings to dodge the JS `Number.MAX_SAFE_INTEGER` ceiling (~9 × 10^15).
 *
 * @param value     Raw input from the bridge / JSON payload.
 * @param fieldName Caller-supplied label (typically the destination property
 *                  name) surfaced in the warn log when precision would be
 *                  lost, so engineers can grep the exact field.
 * @returns         The parsed number, or `null` if input is null/undefined/
 *                  non-string/empty/non-numeric.
 */
export const decodeLongString = (
    value: unknown,
    fieldName: string = '',
): number | null => {
    if (value == null) return null
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string' || value.length === 0) return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    if (!Number.isSafeInteger(parsed)) {
        const label = fieldName || 'decodeLongString'
        logger.warn(
            `${label}: value "${value}" exceeds Number.MAX_SAFE_INTEGER; precision will be lost`,
        )
    }
    return parsed
}

const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
}

// `Intl.NumberFormat` construction is expensive (notably under Hermes), and
// these formatters are called once per rendered row — for a large, fast-
// scrolling asset list that's dozens of constructions per frame, enough to
// block the JS thread and leave FlashList cells blank. The locale and options
// don't change at runtime, so cache one formatter per locale and reuse it.
const decimalFormatterCache = new Map<string, Intl.NumberFormat>()
const getDecimalFormatter = (locale: string): Intl.NumberFormat => {
    let formatter = decimalFormatterCache.get(locale)
    if (!formatter) {
        formatter = Intl.NumberFormat(locale, { style: 'decimal' })
        decimalFormatterCache.set(locale, formatter)
    }
    return formatter
}

export const formatNumber = (
    amount: Decimal,
    precision: number,
    locale: string = 'en-US',
    minPrecision?: number,
) => {
    const decimal = amount.toFixed(Math.max(precision ?? 0, minPrecision ?? 0))

    const parts = decimal.split('.')
    const integer = parts[0]
    const formatter = getDecimalFormatter(locale)
    let formattedInteger = formatter.format(Number(integer))
    const decimalSeparator = formatter.format(1.1).charAt(1)

    let fraction = parts.length > 1 ? decimalSeparator + parts[1] : ''

    const truncateToPrecision = minPrecision ?? precision
    while (
        fraction.length - 1 > truncateToPrecision &&
        fraction.endsWith('0')
    ) {
        fraction = fraction.substring(0, fraction.length - 1)
    }

    let sign = ''
    if (formattedInteger.startsWith('-') || formattedInteger.startsWith('+')) {
        sign = formattedInteger[0]
        formattedInteger = formattedInteger.substring(1)
    }

    return { sign, integer: formattedInteger, fraction }
}

export const formatWithUnits = (
    amount: Decimal,
    units?: '' | 'K' | 'M' | 'B' | 'T',
) => {
    let resultAmount = amount
    let resultUnit = units

    if (!units) {
        const absAmount = amount.abs()
        if (absAmount.gte(1_000_000_000_000)) {
            resultUnit = 'T'
        } else if (absAmount.gte(1_000_000_000)) {
            resultUnit = 'B'
        } else if (absAmount.gte(1_000_000)) {
            resultUnit = 'M'
        } else if (absAmount.gte(1000)) {
            resultUnit = 'K'
        }
    }

    switch (resultUnit) {
        case 'K': {
            resultAmount = amount.div(1000)
            break
        }
        case 'M': {
            resultAmount = amount.div(1_000_000)
            break
        }
        case 'B': {
            resultAmount = amount.div(1_000_000_000)
            break
        }
        case 'T': {
            resultAmount = amount.div(1_000_000_000_000)
            break
        }
    }

    return { amount: resultAmount, unit: resultUnit ?? '' }
}

export const formatRawNumberInput = (
    rawValue: string,
    locale: string = 'en-US',
) => {
    const formatter = getDecimalFormatter(locale)
    const decimalSeparator = formatter.format(1.1).charAt(1)
    const parts = rawValue.split('.')
    const formattedInteger = formatter.format(Number(parts[0] || '0'))
    const fraction = parts.length > 1 ? decimalSeparator + parts[1] : ''
    return `${formattedInteger}${fraction}`
}

export const formatCurrency = (
    value: Decimal | string | number,
    precision: number,
    currency: string,
    locale: string = 'en-US',
    showSymbol: boolean = true,
    truncateToUnits: boolean = false,
    minPrecision?: number,
) => {
    const { amount, unit } = truncateToUnits
        ? formatWithUnits(new Decimal(value))
        : { amount: new Decimal(value), unit: '' }

    const { sign, integer, fraction } = formatNumber(
        amount,
        precision,
        locale,
        minPrecision,
    )
    const currencySymbol =
        !showSymbol || isAlgoAssetName(currency)
            ? undefined
            : (currencySymbols[currency] ?? currency)

    //TODO this is pretty limited formatting - it's not very locale specific
    return `${sign}${currencySymbol ? `${currencySymbol} ` : ''}${integer}${fraction.length > 1 ? fraction : ''}${unit}`
}

// `value` is an already-computed percentage, not a fraction: `12.34` → `"12.34%"`.
export const formatPercentage = (
    value: Decimal | number,
    precision: number = 2,
): string => {
    return `${new Decimal(value).toFixed(precision)}%`
}

export const formatDatetime = (
    datetime?: string | Date,
    locale: string = 'en-US',
    style: 'short' | 'medium' | 'long' = 'long',
    part: 'both' | 'date' | 'time' = 'both',
) => {
    if (!datetime) {
        return ''
    }

    let date: number = Date.now()
    if (typeof datetime === 'string') {
        const parts = datetime.split('+')
        date = Date.parse(parts[0]) //TODO: deal with timezones
    } else {
        date = datetime.getTime()
    }

    const options: Intl.DateTimeFormatOptions = {}
    if (part !== 'time') options.dateStyle = style
    if (part !== 'date') options.timeStyle = 'short'

    return Intl.DateTimeFormat(locale, options).format(date)
}

export const getInitials = (label: string, maxLetters: number = 2): string => {
    const words = label.trim().split(/\s+/)
    if (words.length >= maxLetters) {
        return words
            .slice(0, maxLetters)
            .map(w => w[0])
            .join('')
            .toUpperCase()
    }
    if (words.length === 1 && words[0].length > 0) {
        return words[0][0].toUpperCase()
    }
    return '?'
}

export const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const pluralize = (label: string, time: number) => {
    const ceil = Math.ceil(time)
    if (ceil === 1) {
        if (label === 'month' || label === 'week' || label === 'year') {
            return `last ${label}`
        }
        if (label === 'day') {
            return 'yesterday'
        }
        return `${ceil} ${label} ago`
    }
    return `${ceil} ${label}s ago`
}

//TODO this is a pretty janky implementation = Intl.RelativeTimeFormat wasn't working and I didn't want to import moment just for this
export const formatRelativeTime = (
    datetime: string | Date,
    now: number = Date.now(),
) => {
    let date: number = now
    if (typeof datetime === 'string') {
        const parts = datetime.split('+')
        date = Date.parse(parts[0]) //TODO: deal with timezones
    } else {
        date = datetime.getTime()
    }
    const time = (now - date) / 1000.0 //get seconds

    if (time < 60) {
        //in the last minute
        return 'just now'
    }
    if (time < 60 * 60) {
        //in the last hour
        return pluralize('minute', time / 60)
    }
    if (time < 60 * 60 * 24) {
        return pluralize('hour', time / (60 * 60))
    }
    if (time < 60 * 60 * 24 * 7) {
        return pluralize('day', time / (60 * 60 * 24))
    }
    if (time < 60 * 60 * 24 * 7 * 4) {
        return pluralize('week', time / (60 * 60 * 24 * 7))
    }
    if (time < 60 * 60 * 24 * 7 * 52) {
        return pluralize('month', time / (60 * 60 * 24 * 30))
    }

    return pluralize('year', time / (60 * 60 * 24 * 365))
}
