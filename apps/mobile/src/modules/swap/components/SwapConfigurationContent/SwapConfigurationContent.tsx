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

import { useCallback } from 'react'
import type { SwapConfigurationResult } from '@perawallet/wallet-core-swaps'
import {
    PWButton,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWToolbar,
} from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { BalancePercentageSection } from './BalancePercentageSection'
import { SlippageToleranceSection } from './SlippageToleranceSection'
import { PrimaryCurrencyToggle } from './PrimaryCurrencyToggle'
import { useSwapConfigurationContent } from './useSwapConfigurationContent'

export type SwapConfigurationContentProps = Record<string, never>

export const SwapConfigurationContent = (
    _: SwapConfigurationContentProps = {},
) => {
    const { t } = useLanguage()
    const { resolve, dismiss } = useBottomSheetResult<SwapConfigurationResult>()

    const handleApplyInternal = useCallback(
        (result: SwapConfigurationResult) => {
            resolve(result)
        },
        [resolve],
    )

    const {
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
    } = useSwapConfigurationContent({
        onApply: handleApplyInternal,
    })

    return (
        <PWSheetLayout
            horizontalPadding='none'
            header={
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            onPress={dismiss}
                        />
                    }
                    center={
                        <PWText
                            variant='h4'
                            truncate
                        >
                            {t('swap.configuration.title')}
                        </PWText>
                    }
                    right={
                        <PWButton
                            variant='linkPositive'
                            title={t('swap.configuration.apply')}
                            onPress={handleApply}
                            isDisabled={!isApplyEnabled}
                            paddingStyle='none'
                            testID='swap-config-apply'
                        />
                    }
                    paddingStyle='dense'
                />
            }
        >
            <BalancePercentageSection
                text={balanceText}
                onTextChange={setBalanceText}
                isError={isBalanceError}
            />
            <SlippageToleranceSection
                text={slippageText}
                onTextChange={setSlippageText}
                isError={isSlippageError}
            />
            <PrimaryCurrencyToggle
                value={useLocalCurrency}
                onValueChange={setUseLocalCurrency}
                testID='swap_local_currency_toggle'
            />
        </PWSheetLayout>
    )
}
