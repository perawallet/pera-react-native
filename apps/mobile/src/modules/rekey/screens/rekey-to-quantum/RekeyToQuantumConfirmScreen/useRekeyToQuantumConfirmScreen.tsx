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

import { useRoute, type RouteProp } from '@react-navigation/native'
import { config } from '@perawallet/wallet-core-config'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useRekeyConfirmScreen,
    type UseRekeyConfirmScreenResult,
} from '../../../hooks/useRekeyConfirmScreen'

import type { RekeyToQuantumStackParamList } from '../../../routes/rekey-to-quantum/types'

export const useRekeyToQuantumConfirmScreen =
    (): UseRekeyConfirmScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<RekeyToQuantumStackParamList, 'RekeyToQuantumConfirm'>
            >()
        const { sourceAddress, targetAddress } = route.params

        return useRekeyConfirmScreen({
            sourceAddress,
            targetAddress,
            supportUrl: config.quantumAccountSupportUrl,
            warningI18nPrefix: 'rekey.to_quantum.confirm.replace_warning',
            warningTestID: 'rekey-to-quantum-previous-rekey-warning-sheet',
            onSubmitSuccess: sourceAddr =>
                navigation.navigate('RekeyToQuantum', {
                    screen: 'RekeyToQuantumSuccess',
                    params: { sourceAddress: sourceAddr },
                }),
        })
    }
