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

import { useRoute, type RouteProp } from '@react-navigation/native'
import { config } from '@perawallet/wallet-core-config'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useRekeyConfirmScreen,
    type UseRekeyConfirmScreenResult,
} from '../../../hooks/useRekeyConfirmScreen'

import type { RekeyToSharedStackParamList } from '../../../routes/rekey-to-shared/types'

export const useRekeyToSharedConfirmScreen =
    (): UseRekeyConfirmScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<RekeyToSharedStackParamList, 'RekeyToSharedConfirm'>
            >()
        const { sourceAddress, targetAddress } = route.params

        return useRekeyConfirmScreen({
            sourceAddress,
            targetAddress,
            supportUrl: config.rekeyToSharedSupportUrl,
            warningI18nPrefix: 'rekey.to_shared.confirm.replace_warning',
            warningTestID: 'rekey-to-shared-previous-rekey-warning-sheet',
            onSubmitSuccess: sourceAddr =>
                navigation.navigate('RekeyToShared', {
                    screen: 'RekeyToSharedSuccess',
                    params: { sourceAddress: sourceAddr },
                }),
            // The rekey txn is signed by the shared account's multisig, so it's
            // proposed for cosigning rather than broadcast here. Exit to Home
            // and let the global pending-signatures sheet drive completion —
            // there's no success screen until cosigners sign (matches iOS/
            // Android).
            onProposed: () => navigation.navigate('TabBar', { screen: 'Home' }),
        })
    }
