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
import {
    sendIntegrityControl,
    type IntegrityAccessState,
    type IntegrityBackoff,
} from '@perawallet/wallet-core-browser-runtime'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useIntegrityCheckFrameStore } from '@components/IntegrityCheckFrameHost'
import { useIntegrityAccessState } from '@hooks/useIntegrityAccessState.web'
import { useIntegrityAccessStore } from '@hooks/useIntegrityAccessStore.web'

export type UseIntegrityAccessDiagnosticsResult = {
    accessState: string
    cause: Nullable<string>
    /** Both backoffs, raw: this is the line support asks a user to screenshot. */
    nextAttempt: Nullable<string>
    onForceEnrol: () => void
    onClearBackoff: () => void
}

const describeState = (state: IntegrityAccessState): string => {
    switch (state.status) {
        case 'degraded': {
            return `degraded/${state.reason}`
        }
        case 'checking': {
            return `checking/${state.surface}`
        }
        default: {
            return state.status
        }
    }
}

const describeBackoff = (
    label: string,
    backoff: Nullable<IntegrityBackoff>,
): Nullable<string> =>
    backoff
        ? `${label} ${new Date(backoff.nextAttemptAt).toISOString()} (${backoff.failures})`
        : null

export const useIntegrityAccessDiagnostics =
    (): UseIntegrityAccessDiagnosticsResult => {
        const { state } = useIntegrityAccessState()
        const snapshot = useIntegrityAccessStore(store => store.snapshot)

        const nextAttempt = useMemo(() => {
            const parts = [
                describeBackoff('mint', snapshot?.mintBackoff ?? null),
                describeBackoff('enrol', snapshot?.enrolBackoff ?? null),
            ].filter((part): part is string => part !== null)
            return parts.length > 0 ? parts.join(' · ') : null
        }, [snapshot])

        const onForceEnrol = useCallback(
            () => useIntegrityCheckFrameStore.getState().requestVerify(),
            [],
        )
        const onClearBackoff = useCallback(
            () => sendIntegrityControl({ kind: 'retry' }),
            [],
        )

        return {
            accessState: describeState(state),
            cause: state.status === 'degraded' ? state.cause : null,
            nextAttempt,
            onForceEnrol,
            onClearBackoff,
        }
    }
