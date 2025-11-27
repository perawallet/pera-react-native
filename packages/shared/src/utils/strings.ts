/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { Decimal } from 'decimal.js'

Decimal.set({ precision: 18, crypto: true, rounding: Decimal.ROUND_HALF_UP })

export const encodeToBase64 = (bytes: Uint8Array) => {
    return fromByteArray(bytes)
}

export const decodeFromBase64 = (base64: string) => {
    return toByteArray(base64)
}

//TODO: we should fetch this from the server or a file or something
//(the useCurrencies hook has this but can't use a hook from here...)
const currencySymbols: Record<string, string> = {
    ETH: 'Ξ',
    BTC: '₿',
    USD: '$',
    EUR: '€',
    GBP: '£',
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
    const formatter = Intl.NumberFormat(locale, {
        style: 'decimal',
    })
    let formattedInteger = formatter.format(Number(integer))
    let fraction = parts.length > 1 ? '.' + parts[1] : ''

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
        } else if (absAmount.gte(1_000)) {
            resultUnit = 'K'
        }
    }

    switch (resultUnit) {
        case 'K':
            resultAmount = amount.div(1_000)
            break
        case 'M':
            resultAmount = amount.div(1_000_000)
            break
        case 'B':
            resultAmount = amount.div(1_000_000_000)
            break
        case 'T':
            resultAmount = amount.div(1_000_000_000_000)
            break
    }

    return { amount: resultAmount, unit: resultUnit ?? '' }
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
        ? formatWithUnits(Decimal(value))
        : { amount: Decimal(value), unit: '' }

    const { sign, integer, fraction } = formatNumber(
        amount,
        precision,
        locale,
        minPrecision,
    )
    const currencySymbol =
        !showSymbol || currency === 'ALGO'
            ? ''
            : (currencySymbols[currency] ?? '$')

    //TODO this is pretty limited formatting - it's not very locale specific
    return `${sign}${currencySymbol}${integer}${fraction}${unit}`
}

export const formatDatetime = (
    datetime: string | Date,
    locale: string = 'en-US',
) => {
    let date: number = Date.now()
    if (typeof datetime === 'string') {
        const parts = datetime.split('+')
        date = Date.parse(parts[0]) //TODO: deal with timezones
    } else {
        date = datetime.getTime()
    }

    return Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
        timeStyle: 'short',
    }).format(date)
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
