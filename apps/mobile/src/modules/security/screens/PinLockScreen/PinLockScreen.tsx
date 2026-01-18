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

import { View } from 'react-native'
import { PinEntry } from '@modules/security/components/PinEntry'
import { LockoutView } from './LockoutView'
import { usePinLockScreen } from './usePinLockScreen'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export type PinLockScreenProps = {
    onUnlock: () => void
    onResetData?: () => void
}

export const PinLockScreen = ({
    onUnlock,
    onResetData,
}: PinLockScreenProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        hasError,
        isLockedOut,
        remainingSeconds,
        showBiometric,
        handlePinComplete,
        handleBiometricPress,
        handleErrorAnimationComplete,
    } = usePinLockScreen({ onUnlock })

    if (isLockedOut) {
        return (
            <View style={styles.container}>
                <LockoutView
                    remainingSeconds={remainingSeconds}
                    onResetData={onResetData}
                />
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <PinEntry
                mode='verify'
                title={t('security.pin.unlock_title')}
                onPinComplete={handlePinComplete}
                showBiometric={showBiometric}
                onBiometricPress={handleBiometricPress}
                hasError={hasError}
                onErrorAnimationComplete={handleErrorAnimationComplete}
            />
        </View>
    )
}
