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

import { useRoute } from '@react-navigation/native'
import { config } from '@perawallet/wallet-core-config'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useRekeyConfirmScreen,
    type UseRekeyConfirmScreenResult,
} from '../../../hooks/useRekeyConfirmScreen'

import type { RouteProp } from '@react-navigation/native'
import type { RekeyToLedgerStackParamList } from '../../../routes/rekey-to-ledger/types'

export const useRekeyToLedgerConfirmScreen =
    (): UseRekeyConfirmScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<RekeyToLedgerStackParamList, 'RekeyToLedgerConfirm'>
            >()
        const { sourceAddress, targetAddress } = route.params

        return useRekeyConfirmScreen({
            sourceAddress,
            targetAddress,
            supportUrl: config.rekeyToLedgerSupportUrl,
            warningI18nPrefix: 'rekey.to_ledger.confirm.replace_warning',
            warningTestID: 'rekey-to-ledger-previous-rekey-warning-sheet',
            onSubmitSuccess: sourceAddr =>
                navigation.navigate('RekeyToLedger', {
                    screen: 'RekeyToLedgerSuccess',
                    params: { sourceAddress: sourceAddr },
                }),
        })
    }
