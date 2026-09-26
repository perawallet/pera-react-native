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

import { useCallback, useMemo, useState } from 'react'
import {
    useSwaps,
    type SwapConfigurationResult,
} from '@perawallet/wallet-core-swaps'
import { trackEvent, SwapEvent } from '@analytics'
import {
    MAX_BALANCE_PERCENT,
    MAX_SLIPPAGE,
    MIN_BALANCE_PERCENT,
    MIN_SLIPPAGE,
} from './constants'

type UseSwapConfigurationContentParams = {
    onApply: (result: SwapConfigurationResult) => void
}

type UseSwapConfigurationContentResult = {
    balanceText: string
    setBalanceText: (text: string) => void
    isBalanceError: boolean
    slippageText: string
    setSlippageText: (text: string) => void
    isSlippageError: boolean
    useLocalCurrency: boolean
    setUseLocalCurrency: (value: boolean) => void
    isApplyEnabled: boolean
    handleApply: () => void
}

const normalize = (text: string) => text.replaceAll(',', '.')

const isBalanceInvalid = (text: string): boolean => {
    if (text === '') return false
    const value = Number(text)
    if (Number.isNaN(value)) return true
    if (value === 0) return false
    return value < MIN_BALANCE_PERCENT || value > MAX_BALANCE_PERCENT
}

const isSlippageInvalid = (text: string): boolean => {
    if (text === '') return false
    const value = Number(text)
    if (Number.isNaN(value)) return true
    if (value === 0) return false
    return value < MIN_SLIPPAGE || value > MAX_SLIPPAGE
}

export const useSwapConfigurationContent = ({
    onApply,
}: UseSwapConfigurationContentParams): UseSwapConfigurationContentResult => {
    const { slippage, isLocalCurrencyInput } = useSwaps()

    const [balanceText, setBalanceTextState] = useState('')
    const [slippageText, setSlippageTextState] = useState(slippage ?? '')
    const [useLocalCurrency, setUseLocalCurrencyState] =
        useState(isLocalCurrencyInput)

    const setUseLocalCurrency = useCallback((value: boolean) => {
        trackEvent(
            value
                ? SwapEvent.SettingsLocalCurrencyOn
                : SwapEvent.SettingsLocalCurrencyOff,
        )
        setUseLocalCurrencyState(value)
    }, [])

    const setBalanceText = useCallback((text: string) => {
        setBalanceTextState(normalize(text))
    }, [])

    const setSlippageText = useCallback((text: string) => {
        setSlippageTextState(normalize(text))
    }, [])

    const isBalanceError = useMemo(
        () => isBalanceInvalid(balanceText),
        [balanceText],
    )
    const isSlippageError = useMemo(
        () => isSlippageInvalid(slippageText),
        [slippageText],
    )

    const isApplyEnabled = !isBalanceError && !isSlippageError

    const handleApply = useCallback(() => {
        if (!isApplyEnabled) return

        trackEvent(SwapEvent.SettingsApply)

        const balanceValue = Number(balanceText)
        const balancePercentage =
            balanceText !== '' &&
            !Number.isNaN(balanceValue) &&
            balanceValue > 0
                ? balanceValue
                : null

        const slippageTolerance =
            slippageText !== '' && !Number.isNaN(Number(slippageText))
                ? slippageText
                : null

        onApply({
            balancePercentage,
            slippageTolerance,
            useLocalCurrency,
        })
    }, [balanceText, slippageText, useLocalCurrency, isApplyEnabled, onApply])

    return {
        balanceText,
        setBalanceText,
        isBalanceError,
        slippageText,
        setSlippageText,
        isSlippageError,
        useLocalCurrency,
        setUseLocalCurrency,
        isApplyEnabled,
        handleApply,
    }
}
