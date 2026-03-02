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

import { PWScrollView } from '@components/core'
import { SwapAssetSelectionBottomSheet } from '../SwapAssetSelectionBottomSheet'
import { SwapAmountSection } from '../SwapAmountSection'
import { SwapFormControls } from './SwapFormControls'
import { useSwapForm } from './useSwapForm'
import { useStyles } from './styles'

export const SwapForm = () => {
    const styles = useStyles()
    const {
        payAssetId,
        receiveAssetId,
        payAmount,
        receiveAmount,
        payBalance,
        receiveBalance,
        payAssetModal,
        receiveAssetModal,
        handlePayAmountChange,
        handleSwapDirection,
        handleMaxPress,
        handlePayAssetSelected,
        handleReceiveAssetSelected,
    } = useSwapForm()

    return (
        <>
            <PWScrollView contentContainerStyle={styles.formContainer}>
                <SwapAmountSection
                    variant='pay'
                    assetId={payAssetId}
                    balance={payBalance}
                    amount={payAmount}
                    onAmountChange={handlePayAmountChange}
                    onAssetPress={payAssetModal.open}
                />

                <SwapFormControls
                    onSwapPress={handleSwapDirection}
                    onMaxPress={handleMaxPress}
                />

                <SwapAmountSection
                    variant='receive'
                    assetId={receiveAssetId}
                    balance={receiveBalance}
                    amount={receiveAmount}
                    onAssetPress={receiveAssetModal.open}
                />
            </PWScrollView>

            <SwapAssetSelectionBottomSheet
                isVisible={payAssetModal.isOpen}
                onClose={payAssetModal.close}
                onAssetSelected={handlePayAssetSelected}
            />

            <SwapAssetSelectionBottomSheet
                isVisible={receiveAssetModal.isOpen}
                onClose={receiveAssetModal.close}
                onAssetSelected={handleReceiveAssetSelected}
            />
        </>
    )
}
