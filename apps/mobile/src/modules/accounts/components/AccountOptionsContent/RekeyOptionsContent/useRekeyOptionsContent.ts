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

import { useMemo } from 'react'
import {
    AuthorityTargetCategories,
    useAuthorityTargetCategories,
    type AuthorityTargetCategory,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { IconName } from '@components/core'
import { useCapability } from '@hooks/useCapability'

/**
 * Shared accounts never reach this sheet — they have a single destination
 * type, so their menu row goes straight to the intro screen.
 */
export type RekeyTargetType = Exclude<
    AuthorityTargetCategory,
    typeof AuthorityTargetCategories.shared
>

export type RekeyOptionRow = {
    target: RekeyTargetType
    testID: string
    titleKey: string
    descriptionKey: string
    icon: IconName
}

// In display order; a row shows only when the chain lists a kind under its target.
const ROWS: readonly RekeyOptionRow[] = [
    {
        target: AuthorityTargetCategories.hardware,
        testID: 'rekey_option_ledger',
        titleKey: 'account_options.rekey_option_ledger_title',
        descriptionKey: 'account_options.rekey_option_ledger_description',
        icon: 'ledger',
    },
    {
        target: AuthorityTargetCategories.standard,
        testID: 'rekey_option_standard',
        titleKey: 'account_options.rekey_option_standard_title',
        descriptionKey: 'account_options.rekey_option_standard_description',
        icon: 'wallet',
    },
    {
        target: AuthorityTargetCategories.postQuantum,
        testID: 'rekey_option_quantum',
        titleKey: 'account_options.rekey_option_quantum_title',
        descriptionKey: 'account_options.rekey_option_quantum_description',
        icon: 'quantum',
    },
]

export type UseRekeyOptionsContentResult = {
    rows: readonly RekeyOptionRow[]
}

export const useRekeyOptionsContent = (): UseRekeyOptionsContentResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const categories = useAuthorityTargetCategories(scope)
    const canUseLedger = useCapability({ anyChain: 'ledger' })
    const isQuantumEnabled = useCapability({
        platform: 'quantum',
        anyChain: 'quantumAccounts',
    })

    const rows = useMemo(() => {
        const isSwitchedOn = (target: RekeyTargetType): boolean => {
            if (target === AuthorityTargetCategories.hardware) {
                return canUseLedger
            }
            if (target === AuthorityTargetCategories.postQuantum) {
                return isQuantumEnabled
            }
            return true
        }
        return ROWS.filter(
            row => categories.includes(row.target) && isSwitchedOn(row.target),
        )
    }, [categories, canUseLedger, isQuantumEnabled])

    return { rows }
}
