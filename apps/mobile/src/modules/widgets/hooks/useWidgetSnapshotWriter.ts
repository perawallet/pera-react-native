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

import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { isBackgroundLikeAppState } from '@utils/app-state'
import {
    buildWidgetSnapshot,
    selectWidgetNftImages,
    type BuildWidgetSnapshotInput,
} from '../snapshot'

export type WidgetSnapshotWriterInput = Omit<
    BuildWidgetSnapshotInput,
    'cachedImageKeys'
>

const CLEARED = 'cleared'

export const useWidgetSnapshotWriter = (
    input: WidgetSnapshotWriterInput,
): void => {
    const lastWrittenRef = useRef<Nullable<string>>(null)
    const latestJsonRef = useRef<Nullable<string>>(null)
    // Callers pass fresh objects every render; Decimals serialise to strings,
    // so the key changes exactly when the content does.
    const inputKey = JSON.stringify(input)
    const [stable, setStable] = useState({ key: inputKey, input })
    if (stable.key !== inputKey) {
        setStable({ key: inputKey, input })
    }
    const stableInput = stable.input

    useEffect(() => {
        const widgets = getProvider().widgets
        let isCancelled = false

        const run = async () => {
            if (!stableInput.hasAccounts) {
                latestJsonRef.current = null
                if (lastWrittenRef.current !== CLEARED) {
                    lastWrittenRef.current = CLEARED
                    await widgets.clearSnapshot()
                }
                return
            }

            // Purge on privacy so no NFT image outlives the setting; while NFTs
            // are still loading, leave the cache alone rather than wipe it.
            let cachedImageKeys: string[] = []
            if (stableInput.isPrivacyMode) {
                await widgets.syncImages([])
            } else if (stableInput.nfts) {
                cachedImageKeys = await widgets.syncImages(
                    selectWidgetNftImages(stableInput.nfts),
                )
            }
            if (isCancelled) return

            const snapshot = buildWidgetSnapshot({
                ...stableInput,
                cachedImageKeys,
            })
            if (!snapshot) return

            const json = JSON.stringify(snapshot)
            latestJsonRef.current = json
            if (json === lastWrittenRef.current) return
            lastWrittenRef.current = json
            await widgets.writeSnapshot(json)
        }

        void run()
        return () => {
            isCancelled = true
        }
    }, [stableInput])

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => {
            const json = latestJsonRef.current
            if (json && isBackgroundLikeAppState(state)) {
                void getProvider().widgets.writeSnapshot(json)
            }
        })
        return () => subscription.remove()
    }, [])
}
