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

import { PWScrollView, PWView } from '@components/core'
import { PeraCardVisual } from './PeraCardVisual'
import { RevealCardDetailsButton } from './RevealCardDetailsButton'
import { CardFundingAccountSection } from './CardFundingAccountSection'
import { CardOptionsSection } from './CardOptionsSection'
import { usePeraCardDetails } from './usePeraCardDetails'
import { useStyles } from './styles'

export const PeraCardDetails = () => {
    const styles = useStyles()
    const {
        maskedPan,
        secureImageUrl,
        isRevealing,
        onToggleReveal,
        onSecureImageError,
        fundingAddress,
        onChangeFunding,
        isFrozen,
        freezeLabel,
        isFreezing,
        canToggleFreeze,
        onToggleFreeze,
        onSetPin,
        isSettingPin,
        onAccountsDetails,
        walletPlatform,
        onAddToWallet,
        onReportLostStolen,
        onReportSuspicious,
        onCancelCard,
    } = usePeraCardDetails()

    return (
        <PWScrollView contentContainerStyle={styles.content}>
            <PWView style={styles.cardBlock}>
                <PeraCardVisual
                    maskedPan={maskedPan}
                    secureImageUrl={secureImageUrl ?? undefined}
                    onSecureImageError={onSecureImageError}
                />
                <RevealCardDetailsButton
                    isLoading={isRevealing}
                    isRevealed={secureImageUrl != null}
                    onPress={onToggleReveal}
                />
            </PWView>

            <CardFundingAccountSection
                address={fundingAddress}
                onChange={onChangeFunding}
            />

            <CardOptionsSection
                isFrozen={isFrozen}
                freezeLabel={freezeLabel}
                isFreezing={isFreezing}
                canToggleFreeze={canToggleFreeze}
                walletPlatform={walletPlatform}
                isSettingPin={isSettingPin}
                onAccountsDetails={onAccountsDetails}
                onAddToWallet={onAddToWallet}
                onSetPin={onSetPin}
                onToggleFreeze={onToggleFreeze}
                onReportLostStolen={onReportLostStolen}
                onReportSuspicious={onReportSuspicious}
                onCancelCard={onCancelCard}
            />
        </PWScrollView>
    )
}
