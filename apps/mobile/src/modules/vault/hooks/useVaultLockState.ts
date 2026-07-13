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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    isUnlocked as readIsUnlocked,
    isVaultInitialized,
    onLockStateChanged,
} from '@perawallet/wallet-extension-keystore-chrome'

type UseVaultLockStateResult = {
    isInitialized: boolean | null
    isUnlocked: boolean | null
    refresh: () => Promise<void>
}

// Deviation from the Zustand-for-local-state rule (documented): the source of
// truth is chrome.storage.session shared across extension contexts — a
// process-local Zustand store would just shadow it. This hook subscribes to
// the cross-context change feed directly.
export const useVaultLockState = (): UseVaultLockStateResult => {
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null)
    const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null)

    // Guards against a lock-state change event landing between refresh()'s
    // async reads and its setState: without this, the event's authoritative
    // value gets clobbered by the stale read once it resolves. Each refresh()
    // call and each change event bumps the token; a refresh only applies its
    // result if nothing newer (another refresh or an event) has happened since.
    const refreshTokenRef = useRef(0)

    const refresh = useCallback(async (): Promise<void> => {
        const token = ++refreshTokenRef.current
        const [initialized, unlocked] = await Promise.all([
            isVaultInitialized(),
            readIsUnlocked(),
        ])
        if (token !== refreshTokenRef.current) return
        setIsInitialized(initialized)
        setIsUnlocked(unlocked)
    }, [])

    useEffect(() => {
        void refresh()
        const unsubscribe = onLockStateChanged(unlocked => {
            refreshTokenRef.current++
            setIsUnlocked(unlocked)
            if (unlocked) setIsInitialized(true)
        })
        return unsubscribe
    }, [refresh])

    return { isInitialized, isUnlocked, refresh }
}
