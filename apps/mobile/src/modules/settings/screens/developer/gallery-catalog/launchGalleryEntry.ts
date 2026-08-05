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

import { navigationRef } from '@routes/navigationRef'
import { useBottomSheetStore } from '@modules/bottom-sheet'

import type { GalleryEntry } from './types'

const nav = navigationRef as unknown as {
    isReady: () => boolean
    navigate: (name: string, params?: object) => void
}

export type GalleryLaunchOutcome = 'launched' | 'navigation-not-ready'

/**
 * Non-hook counterpart of `useGalleryLauncher`, so the locale tour can launch
 * the same catalog entries the gallery UI does without a React context. The
 * hook delegates here — one launch implementation, two callers.
 */
export const launchGalleryEntry = (
    entry: GalleryEntry,
): GalleryLaunchOutcome => {
    const { launch } = entry

    // Only `navigate` and `preview` touch the navigation container. A tour
    // deeplink can arrive before it mounts, and navigating before
    // `isReady()` is a silent no-op that would screenshot the wrong surface.
    // `action`/`sheet`/`sheetByType` have no such dependency and must still
    // run — gating them here would silently no-op things like the seed
    // actions in tools.catalog.ts.
    if (
        (launch.kind === 'navigate' || launch.kind === 'preview') &&
        !nav.isReady()
    ) {
        return 'navigation-not-ready'
    }

    const sheet = useBottomSheetStore.getState()

    switch (launch.kind) {
        case 'navigate': {
            nav.navigate(launch.target.name, launch.target.params)
            break
        }
        case 'sheet': {
            void sheet.request(launch.request())
            break
        }
        case 'sheetByType': {
            void sheet.requestByType(launch.type, launch.props, launch.options)
            break
        }
        case 'action': {
            launch.run()
            break
        }
        case 'preview': {
            // GalleryPreview is a DeveloperSettingsStack screen, nested three
            // levels under the root navigator (Settings -> DeveloperSettings
            // -> GalleryPreview) — a bare route name here resolves against
            // nothing and silently no-ops. Nest the params instead, the same
            // shape the retired galleryTour.ts drove successfully.
            nav.navigate('Settings', {
                screen: 'DeveloperSettings',
                params: {
                    screen: 'GalleryPreview',
                    params: { entryId: entry.id },
                },
            })
            break
        }
    }

    return 'launched'
}
