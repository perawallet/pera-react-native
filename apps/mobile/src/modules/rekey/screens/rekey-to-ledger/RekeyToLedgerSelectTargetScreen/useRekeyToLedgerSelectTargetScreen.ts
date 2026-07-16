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

import { useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    isEligibleLedgerRekeyTarget,
    useAllAccounts,
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useAppNavigation } from '@hooks/useAppNavigation'

import type { RekeyToLedgerStackParamList } from '../../../routes/rekey-to-ledger/types'

export type UseRekeyToLedgerSelectTargetScreenResult = {
    sourceAddress: string
    targets: WalletAccount[]
    handleSelect: (target: WalletAccount) => void
}

export const useRekeyToLedgerSelectTargetScreen =
    (): UseRekeyToLedgerSelectTargetScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<
                    RekeyToLedgerStackParamList,
                    'RekeyToLedgerSelectTarget'
                >
            >()
        const sourceAddress = route.params.sourceAddress
        const accounts = useAllAccounts()
        const source = useFindAccountByAddress(sourceAddress)

        const targets = useMemo(
            () =>
                accounts.filter(account =>
                    isEligibleLedgerRekeyTarget(
                        account,
                        source ?? { address: sourceAddress },
                    ),
                ),
            [accounts, source, sourceAddress],
        )

        const handleSelect = useCallback(
            (target: WalletAccount) => {
                navigation.navigate('RekeyToLedger', {
                    screen: 'RekeyToLedgerConfirm',
                    params: {
                        sourceAddress,
                        targetAddress: target.address,
                    },
                })
            },
            [navigation, sourceAddress],
        )

        return {
            sourceAddress,
            targets,
            handleSelect,
        }
    }
