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

import { useCallback } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    useAuthorityTargets,
    useFindAccountByAddress,
    type WalletAccount,
    addressOn,
} from '@perawallet/wallet-core-accounts'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useAppNavigation } from '@hooks/useAppNavigation'

import type { RekeyToStandardStackParamList } from '../../../routes/rekey-to-standard/types'

export type UseRekeyToStandardSelectTargetScreenResult = {
    sourceAddress: string
    targets: WalletAccount[]
    handleSelect: (target: WalletAccount) => void
}

export const useRekeyToStandardSelectTargetScreen =
    (): UseRekeyToStandardSelectTargetScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<
                    RekeyToStandardStackParamList,
                    'RekeyToStandardSelectTarget'
                >
            >()
        const sourceAddress = route.params.sourceAddress
        const scope = useSelectedScope(LEGACY_CHAIN_ID)
        const source = useFindAccountByAddress(sourceAddress, scope)

        const targets = useAuthorityTargets(source, 'standard', scope)

        const handleSelect = useCallback(
            (target: WalletAccount) => {
                const targetAddress = addressOn(target, scope)
                if (!targetAddress) return
                navigation.navigate('RekeyToStandard', {
                    screen: 'RekeyToStandardConfirm',
                    params: {
                        sourceAddress,
                        targetAddress,
                    },
                })
            },
            [navigation, scope, sourceAddress],
        )

        return {
            sourceAddress,
            targets,
            handleSelect,
        }
    }
