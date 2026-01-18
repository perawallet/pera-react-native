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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { PinEntry, PinEntryMode } from '@modules/security/components/PinEntry'
import { usePinEntryScreen } from './usePinEntryScreen'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import type { SecurityStackParamsList } from '@modules/security/routes'

type PinEntryScreenRouteProp = RouteProp<SecurityStackParamsList, 'PinEntry'>
type PinEntryScreenNavigationProp = NativeStackNavigationProp<
    SecurityStackParamsList,
    'PinEntry'
>

export const PinEntryScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<PinEntryScreenNavigationProp>()
    const route = useRoute<PinEntryScreenRouteProp>()

    const { mode, onSuccess } = route.params ?? { mode: 'setup' }

    const {
        currentMode,
        title,
        subtitle,
        hasError,
        isDisabled,
        showBiometric,
        handlePinComplete,
        handleBiometricPress,
        handleErrorAnimationComplete,
    } = usePinEntryScreen({
        mode,
        onSuccess: () => {
            onSuccess?.()
            navigation.goBack()
        },
    })

    return (
        <View style={styles.container}>
            <PinEntry
                mode={currentMode}
                title={title}
                subtitle={subtitle}
                onPinComplete={handlePinComplete}
                isDisabled={isDisabled}
                showBiometric={showBiometric}
                onBiometricPress={handleBiometricPress}
                hasError={hasError}
                onErrorAnimationComplete={handleErrorAnimationComplete}
            />
        </View>
    )
}
