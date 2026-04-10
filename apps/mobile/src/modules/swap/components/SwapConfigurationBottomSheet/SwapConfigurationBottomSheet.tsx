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

import { useCallback } from 'react'
import type { SwapConfigurationResult } from '@perawallet/wallet-core-swaps'
import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BalancePercentageSection } from './BalancePercentageSection'
import { SlippageToleranceSection } from './SlippageToleranceSection'
import { PrimaryCurrencyToggle } from './PrimaryCurrencyToggle'
import { useSwapConfigurationBottomSheet } from './useSwapConfigurationBottomSheet'
import { useStyles } from './styles'

export type SwapConfigurationBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onApply: (result: SwapConfigurationResult) => void
}

export const SwapConfigurationBottomSheet = ({
    isVisible,
    onClose,
    onApply,
}: SwapConfigurationBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const handleApplyInternal = useCallback(
        (result: SwapConfigurationResult) => {
            onApply(result)
            onClose()
        },
        [onApply, onClose],
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
    } = useSwapConfigurationBottomSheet({
        isVisible,
        onApply: handleApplyInternal,
    })

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            size='lg'
        >
            <PWView style={styles.container}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            onPress={onClose}
                        />
                    }
                    center={
                        <PWText variant='h4'>
                            {t('swap.configuration.title')}
                        </PWText>
                    }
                    right={
                        <PWButton
                            variant='link'
                            title={t('swap.configuration.apply')}
                            onPress={handleApply}
                            isDisabled={!isApplyEnabled}
                            paddingStyle='none'
                            testID='swap-config-apply'
                        />
                    }
                    paddingStyle='dense'
                />
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
                />
            </PWView>
        </PWBottomSheet>
    )
}
