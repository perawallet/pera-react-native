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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    useSwaps,
    type SwapConfigurationResult,
} from '@perawallet/wallet-core-swaps'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    MAX_BALANCE_PERCENT,
    MAX_SLIPPAGE,
    MIN_BALANCE_PERCENT,
    MIN_SLIPPAGE,
} from './constants'

type UseSwapConfigurationBottomSheetParams = {
    isVisible: boolean
    onApply: (result: SwapConfigurationResult) => void
}

type UseSwapConfigurationBottomSheetResult = {
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

export const useSwapConfigurationBottomSheet = ({
    isVisible,
    onApply,
}: UseSwapConfigurationBottomSheetParams): UseSwapConfigurationBottomSheetResult => {
    const { slippage } = useSwaps()
    const { preferredCurrency } = useCurrency()
    const isAlgoPreferred = preferredCurrency === 'ALGO'

    const slippageRef = useRef(slippage)
    slippageRef.current = slippage
    const isAlgoPreferredRef = useRef(isAlgoPreferred)
    isAlgoPreferredRef.current = isAlgoPreferred

    const [balanceText, setBalanceTextState] = useState('')
    const [slippageText, setSlippageTextState] = useState(slippage ?? '')
    const [useLocalCurrency, setUseLocalCurrency] = useState(!isAlgoPreferred)

    // Reset form whenever the sheet becomes visible so stale edits don't persist
    useEffect(() => {
        if (isVisible) {
            setBalanceTextState('')
            setSlippageTextState(slippageRef.current ?? '')
            setUseLocalCurrency(!isAlgoPreferredRef.current)
        }
    }, [isVisible])

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
