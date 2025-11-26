import type Decimal from 'decimal.js'

export type Currency = {
    id: string
    name: string
    symbol: string
}

export type CurrencyPrice = {
    id: string
    usdPrice: Decimal
}

export type CurrenciesList = Currency[]

export type CurrenciesListResponse = CurrencyResponse[]

export type CurrencyResponse = {
    readonly generated_at?: string
    currency_id: string
    name: string
    symbol: string
    readonly exchange_price?: string
    readonly last_updated_at?: string
    readonly usd_value?: string
}

export type CurrenciesStore = {
    preferredCurrency: string
    setPreferredCurrency: (currency: string) => void
}
