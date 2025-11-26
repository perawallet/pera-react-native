import { useCallback } from 'react'
import { useCurrenciesStore } from '../store'
import { usePreferredCurrencyPriceQuery } from './usePreferredCurrencyPriceQuery'
import Decimal from 'decimal.js'

export const useCurrency = () => {
    const { preferredCurrency, setPreferredCurrency } = useCurrenciesStore()
    const { data, isPending } =
        usePreferredCurrencyPriceQuery(preferredCurrency)

    const usdToPreferred = useCallback<(usdAmount: Decimal) => Decimal>(
        (usdAmount: Decimal) => {
            if (isPending) {
                return Decimal(0)
            }

            if (preferredCurrency === 'USD') {
                return usdAmount
            }

            const usdValue = data?.usdPrice ?? Decimal('0')
            return usdAmount.mul(usdValue)
        },
        [isPending, data],
    )

    return {
        preferredCurrency,
        setPreferredCurrency,
        usdToPreferred,
    }
}
