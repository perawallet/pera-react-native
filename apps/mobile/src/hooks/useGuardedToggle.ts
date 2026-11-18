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

import { useCallback, useRef, useState } from 'react'
import { assertOnline } from '@perawallet/wallet-core-shared'
import { useErrorToast } from './useErrorToast'
import { useLanguage } from './useLanguage'

export type GuardedToggleSteps = {
    /** The optimistic store write, applied before the request starts. */
    write: () => void
    /** Tells the backend; rejecting rolls the write back. */
    commit: () => Promise<void>
    rollback: () => void
}

export type UseGuardedToggleResult<Key> = {
    /**
     * Resolves `true` only when `commit` succeeded. When any of `keys` is
     * already in `inFlight`, from any instance, resolves `false` without
     * running a step.
     */
    runToggle: (
        keys: readonly Key[],
        steps: GuardedToggleSteps,
    ) => Promise<boolean>
    /**
     * In flight *as started by this instance*, and reactive so it can drive a
     * `disabled` prop. Not shared module-wide like the guard: another
     * instance's toggle won't flip this one's flag.
     */
    isTogglePending: (key: Key) => boolean
}

/**
 * `inFlight` is the caller's module-scope set, so two taps in the same tick,
 * from any instance, both see the first one. Without the guard, two
 * overlapping failures roll each other back to the wrong value.
 */
export const useGuardedToggle = <Key>(
    inFlight: Set<Key>,
): UseGuardedToggleResult<Key> => {
    const { showError } = useErrorToast()
    const { t } = useLanguage()

    // Only what THIS instance added, never the shared set's contents:
    // mirroring it would report another instance's key as pending, and that
    // stale `true` would never clear, since only the owner removes it.
    const ownPendingRef = useRef<Set<Key>>(new Set())
    const [pending, setPending] = useState<readonly Key[]>([])

    const runToggle = useCallback(
        async (
            keys: readonly Key[],
            { write, commit, rollback }: GuardedToggleSteps,
        ): Promise<boolean> => {
            if (keys.some(key => inFlight.has(key))) return false

            keys.forEach(key => {
                inFlight.add(key)
                ownPendingRef.current.add(key)
            })
            setPending([...ownPendingRef.current])
            write()

            try {
                // Fail fast offline instead of trusting the native transport
                // to reject. Registration runs under networkMode 'always', and
                // Android in airplane mode doesn't reject promptly, so without
                // this the rollback below never runs and the persisted store
                // diverges from the backend.
                assertOnline()
                await commit()
                return true
            } catch (error) {
                rollback()
                showError(error, t('common.error.title'))
                return false
            } finally {
                keys.forEach(key => {
                    inFlight.delete(key)
                    ownPendingRef.current.delete(key)
                })
                setPending([...ownPendingRef.current])
            }
        },
        [inFlight, showError, t],
    )

    const isTogglePending = useCallback(
        (key: Key): boolean => pending.includes(key),
        [pending],
    )

    return { runToggle, isTogglePending }
}
