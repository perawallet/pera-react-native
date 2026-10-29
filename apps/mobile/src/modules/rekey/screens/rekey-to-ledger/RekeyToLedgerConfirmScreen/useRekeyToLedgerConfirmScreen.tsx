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
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { RekeyWarningCopy } from '@modules/rekey/components/PreviousRekeyWarningSheet'
import {
    useRekeyConfirmScreen,
    type UseRekeyConfirmScreenResult,
} from '@modules/rekey/hooks/useRekeyConfirmScreen'

import type { RekeyToLedgerStackParamList } from '@modules/rekey/routes/rekey-to-ledger/types'

const WARNING_COPY: RekeyWarningCopy = {
    titleKey: i18nKey('rekey.to_ledger.confirm.replace_warning.title'),
    bodyKey: i18nKey('rekey.to_ledger.confirm.replace_warning.body'),
    confirmKey: i18nKey('rekey.to_ledger.confirm.replace_warning.confirm'),
    cancelKey: i18nKey('rekey.to_ledger.confirm.replace_warning.cancel'),
}

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
            warningCopy: WARNING_COPY,
            warningTestID: 'rekey-to-ledger-previous-rekey-warning-sheet',
            onSubmitSuccess: sourceAddr =>
                navigation.navigate('RekeyToLedger', {
                    screen: 'RekeyToLedgerSuccess',
                    params: { sourceAddress: sourceAddr },
                }),
        })
    }
