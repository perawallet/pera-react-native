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

import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

type UseAddressSelectionOptions = {
    /** Addresses selected on first render. */
    initial?: string[]
    /** Addresses that cannot be toggled (e.g. already-imported accounts). */
    disabledAddresses?: Set<string>
}

type UseAddressSelectionResult = {
    selectedAddresses: Set<string>
    setSelectedAddresses: Dispatch<SetStateAction<Set<string>>>
    isAllSelected: boolean
    toggle: (address: string) => void
    toggleSelectAll: () => void
}

// Multi-select state shared by the account/address selection screens (ledger
// import, rekeyed-address import, address import, rescan): a Set of selected
// addresses with toggle, select-all/none, and an optional disabled set.
export const useAddressSelection = (
    selectableAddresses: string[],
    options?: UseAddressSelectionOptions,
): UseAddressSelectionResult => {
    const { initial, disabledAddresses } = options ?? {}
    const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(
        () => new Set(initial ?? []),
    )

    const isAllSelected =
        selectableAddresses.length > 0 &&
        selectableAddresses.every(address => selectedAddresses.has(address))

    const toggle = useCallback(
        (address: string) => {
            if (disabledAddresses?.has(address)) return

            setSelectedAddresses(prev => {
                const next = new Set(prev)
                if (next.has(address)) {
                    next.delete(address)
                } else {
                    next.add(address)
                }
                return next
            })
        },
        [disabledAddresses],
    )

    const toggleSelectAll = useCallback(() => {
        setSelectedAddresses(
            isAllSelected ? new Set() : new Set(selectableAddresses),
        )
    }, [isAllSelected, selectableAddresses])

    return {
        selectedAddresses,
        setSelectedAddresses,
        isAllSelected,
        toggle,
        toggleSelectAll,
    }
}
