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

import { useCallback, useState } from 'react'

import {
    applyDeclaration,
    resolveAgeGate,
    useAgeGateStore,
    type AgeGateStatus,
} from '@perawallet/wallet-core-age-gate'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AgeDeclarationContent } from '@modules/age-gate/components/AgeDeclarationContent'

type UseAgeGateResult = {
    status: AgeGateStatus
    isAdult: boolean
    isChecking: boolean
    ensureChecked: () => void
    retry: () => void
}

export const useAgeGate = (): UseAgeGateResult => {
    const status = useAgeGateStore(state => state.status) ?? 'unknown'
    const { request } = useBottomSheet()

    // True while a platform age check / declaration is in flight. Seeded true
    // when the status is still unresolved so the gate shows the loading screen
    // from the first frame (the platform check can take a few seconds) instead
    // of briefly flashing the restricted fallback.
    const [isChecking, setIsChecking] = useState(
        status !== 'adult' && status !== 'minor',
    )

    const run = useCallback(
        async (force: boolean) => {
            setIsChecking(true)
            try {
                const result = await resolveAgeGate(
                    force ? { force: true } : {},
                )
                if (result.kind === 'needs-declaration') {
                    // confirm => 'I am 18 or older' (true); cancel => 'I am under
                    // 18' resolves undefined. Anything not affirmative => minor
                    // (no bypass).
                    const answer = await request<boolean>({
                        contents: <AgeDeclarationContent />,
                        options: {
                            size: 'auto',
                            enablePanDownToClose: false,
                            enableCloseOnBackdropPress: false,
                        },
                    })
                    applyDeclaration(answer === true)
                }
            } finally {
                setIsChecking(false)
            }
        },
        [request],
    )

    const ensureChecked = useCallback(() => {
        if (status === 'adult' || status === 'minor') return
        void run(false)
    }, [run, status])

    const retry = useCallback(() => {
        void run(true)
    }, [run])

    return {
        status,
        isAdult: status === 'adult',
        isChecking,
        ensureChecked,
        retry,
    }
}
