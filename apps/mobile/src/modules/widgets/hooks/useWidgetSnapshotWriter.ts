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
import type { WidgetImageRequest } from '@perawallet/wallet-extension-platform'
import { isBackgroundLikeAppState } from '@utils/app-state'
import {
    buildWidgetSnapshot,
    selectWidgetNftImages,
    type BuildWidgetSnapshotInput,
} from '../snapshot'
import { useWidgetWipeStore } from '../store'

export type WidgetSnapshotWriterInput = Omit<
    BuildWidgetSnapshotInput,
    'cachedImageKeys'
>

const CLEARED = 'cleared'

const isWiping = () => useWidgetWipeStore.getState().isWiping

export const useWidgetSnapshotWriter = (
    input: WidgetSnapshotWriterInput,
): void => {
    const lastWrittenRef = useRef<Nullable<string>>(null)
    const latestJsonRef = useRef<Nullable<string>>(null)
    const hasPurgedImagesRef = useRef(false)
    // Bumped when a wipe starts, so a run already past an await stands down.
    const generationRef = useRef(0)
    // Image syncs run one at a time, so a purge can't land before a download
    // that started earlier and then be undone by it.
    const imageSyncRef = useRef<Promise<unknown>>(Promise.resolve())
    // Callers pass fresh objects every render; Decimals serialise to strings,
    // so the key changes exactly when the content does.
    const inputKey = JSON.stringify(input)
    const [stable, setStable] = useState({ key: inputKey, input })
    if (stable.key !== inputKey) {
        setStable({ key: inputKey, input })
    }
    const stableInput = stable.input

    useEffect(
        () =>
            useWidgetWipeStore.subscribe(state => {
                if (!state.isWiping) return
                generationRef.current += 1
                latestJsonRef.current = null
                lastWrittenRef.current = null
                hasPurgedImagesRef.current = false
            }),
        [],
    )

    useEffect(() => {
        const widgets = getProvider().widgets
        const generation = generationRef.current
        let isCancelled = false
        const isStale = () =>
            isCancelled || isWiping() || generation !== generationRef.current

        const syncImages = (items: WidgetImageRequest[]) => {
            const next = imageSyncRef.current.then(() =>
                widgets.syncImages(items),
            )
            imageSyncRef.current = next.catch(() => undefined)
            return next
        }

        const write = async (json: string) => {
            latestJsonRef.current = json
            if (json === lastWrittenRef.current) return
            lastWrittenRef.current = json
            await widgets.writeSnapshot(json)
        }

        const run = async () => {
            if (isWiping()) return

            if (!stableInput.hasAccounts) {
                latestJsonRef.current = null
                if (lastWrittenRef.current !== CLEARED) {
                    lastWrittenRef.current = CLEARED
                    await widgets.clearSnapshot()
                }
                return
            }

            if (stableInput.isPrivacyMode) {
                // The hidden shape lists no images, so it goes out before the
                // purge: a visible snapshot must not outlive the setting.
                const snapshot = buildWidgetSnapshot({
                    ...stableInput,
                    cachedImageKeys: [],
                })
                if (snapshot) await write(JSON.stringify(snapshot))
                if (isStale() || hasPurgedImagesRef.current) return
                hasPurgedImagesRef.current = true
                await syncImages([])
                return
            }

            // Loading or failed NFT reads leave the cache alone rather than wipe it.
            let cachedImageKeys: string[] = []
            if (stableInput.nfts) {
                hasPurgedImagesRef.current = false
                cachedImageKeys = await syncImages(
                    selectWidgetNftImages(stableInput.nfts),
                )
                if (generation !== generationRef.current) {
                    // A wipe cleared the App Group while this download ran.
                    await widgets.clearSnapshot()
                    return
                }
            }
            if (isStale()) return

            const snapshot = buildWidgetSnapshot({
                ...stableInput,
                cachedImageKeys,
            })
            if (snapshot) await write(JSON.stringify(snapshot))
        }

        void run()
        return () => {
            isCancelled = true
        }
    }, [stableInput])

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => {
            const json = latestJsonRef.current
            if (json && !isWiping() && isBackgroundLikeAppState(state)) {
                void getProvider().widgets.writeSnapshot(json)
            }
        })
        return () => subscription.remove()
    }, [])
}
