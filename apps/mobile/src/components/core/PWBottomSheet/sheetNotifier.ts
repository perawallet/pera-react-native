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

import { createRef, useCallback, useRef, type RefCallback } from 'react'
import type { NotifierRoot } from 'react-native-notifier'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * The notifier of the top-most open sheet, for toasts that must show above it
 * (`notifier: bottomSheetNotifier.current ?? undefined`). Null when no sheet is
 * open, so callers fall back to the app-level notifier.
 */
export const bottomSheetNotifier = createRef<Nullable<NotifierRoot>>()

// Every open sheet hosts its own notifier, in the order the sheets opened.
// A shared ref alone would go null when a stacked sheet closes, leaving the
// sheet underneath (such as the in-app browser) without a notifier.
const openNotifiers: NotifierRoot[] = []

const pointAtTopSheet = (): void => {
    bottomSheetNotifier.current = openNotifiers.at(-1) ?? null
}

/** Ref for a sheet's NotifierWrapper: registers it while the sheet is open. */
export const useSheetNotifierRef = (): RefCallback<NotifierRoot> => {
    const attached = useRef<Nullable<NotifierRoot>>(null)
    return useCallback((notifier: Nullable<NotifierRoot>) => {
        if (attached.current) {
            const index = openNotifiers.lastIndexOf(attached.current)
            if (index !== -1) openNotifiers.splice(index, 1)
        }
        attached.current = notifier
        if (notifier) openNotifiers.push(notifier)
        pointAtTopSheet()
    }, [])
}
