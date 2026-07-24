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

import { PWScrollView, PWView } from '@components/core'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { CardFrozenBanner } from '../CardFrozenBanner'
import { PeraCardVisual } from './PeraCardVisual'
import { RevealCardDetailsButton } from './RevealCardDetailsButton'
import { CardFundingAccountSection } from './CardFundingAccountSection'
import { CardOptionsSection } from './CardOptionsSection'
import { usePeraCardDetails } from './usePeraCardDetails'
import { useStyles } from './styles'

// Labels this caller in screen-capture logs; the native lock is shared.
const SCREEN_CAPTURE_TAG = 'pera-card-details'

export const PeraCardDetails = () => {
    const styles = useStyles()
    const {
        maskedPan,
        secureImageUrl,
        isCardOpen,
        isRevealing,
        onToggleReveal,
        onSecureImageLoad,
        onSecureImageError,
        fundingAddress,
        onChangeFunding,
        hasCard,
        fundingTypeLabel,
        onChangeFundingType,
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
    } = usePeraCardDetails()

    // Block screenshots/recording while the real PAN/CVV is (or is becoming)
    // visible, matching the other secure screens (passphrase, backup, import).
    usePreventScreenCapture(SCREEN_CAPTURE_TAG, isCardOpen || isRevealing)

    return (
        <PWScrollView contentContainerStyle={styles.content}>
            <CardFrozenBanner />

            <PWView style={styles.cardBlock}>
                <PeraCardVisual
                    maskedPan={maskedPan}
                    secureImageUrl={secureImageUrl ?? undefined}
                    isOpen={isCardOpen}
                    onSecureImageLoad={onSecureImageLoad}
                    onSecureImageError={onSecureImageError}
                />
                <RevealCardDetailsButton
                    isLoading={isRevealing}
                    // "Hide" only once the card is actually open; disabled while
                    // the first reveal loads, so the label is never a mismatch.
                    isRevealed={isCardOpen}
                    onPress={onToggleReveal}
                />
            </PWView>

            <CardFundingAccountSection
                address={fundingAddress}
                onChange={onChangeFunding}
                hasCard={hasCard}
                fundingTypeLabel={fundingTypeLabel}
                onChangeFundingType={onChangeFundingType}
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
            />
        </PWScrollView>
    )
}
