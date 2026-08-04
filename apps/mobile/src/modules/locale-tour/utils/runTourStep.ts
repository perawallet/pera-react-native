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

import i18n from 'i18next'
import { InteractionManager } from 'react-native'

import {
    useBottomSheetStore,
    type InternalRequest,
} from '@modules/bottom-sheet'
import {
    launchGalleryEntry,
    type GalleryLaunchOutcome,
} from '@modules/settings/screens/developer/gallery-catalog/launchGalleryEntry'
import type { GalleryLaunch } from '@modules/settings/screens/developer/gallery-catalog/types'

import { drainOverflow } from '@components/core/PWText/overflowRegistry'

import { getTourStep } from './steps'
import type { RunTourStepOutcome, RunTourStepParams } from '../types'

export const TOUR_SHOT_MARKER = 'LOCALE_TOUR_SHOT'
export const TOUR_ERROR_MARKER = 'LOCALE_TOUR_ERR'
export const TOUR_OVERFLOW_MARKER = 'LOCALE_TOUR_OVERFLOW'

// A surface that never finishes its interactions (a stuck animation, a
// pending layout) must not hang the driver forever — it needs an answer,
// even if that answer is "settled by timeout, screenshot anyway".
//
// Calibrated against a real device run (iPhone 16 Pro Max sim):
// step-latency p95 was ~2.1s and max ~2.7-3.2s, with 57 of 75 sheet-mount
// attempts hitting the old 2000ms cap and reporting a false "never mounted".
// 5000ms clears the observed max with headroom. Do not lower this back
// toward 2000 without a fresh measured run — that number was too tight.
export const SETTLE_TIMEOUT_MS = 5000

const waitForSettle = (): Promise<void> =>
    new Promise(resolve => {
        const timer = setTimeout(resolve, SETTLE_TIMEOUT_MS)
        // Callback form, not the returned handle: the app's real
        // InteractionManager returns { then, done, cancel }, but the mock
        // used under test invokes and returns the callback's result instead.
        InteractionManager.runAfterInteractions(() => {
            requestAnimationFrame(() => {
                clearTimeout(timer)
                resolve()
            })
        })
    })

const isSheetLaunch = (kind: GalleryLaunch['kind']): boolean =>
    kind === 'sheet' || kind === 'sheetByType'

// `request()`/`requestByType()` push into the store synchronously when a
// BottomSheetManager host is already registered, but silently reject (no
// throw, no store change — see bottomSheetStore.ts) when a tour deeplink
// arrives before any host has mounted. Without this wait, that failure is
// invisible: launchGalleryEntry doesn't throw, so the code would fall
// straight through to the generic settle and screenshot whatever screen was
// already on top, filed under the sheet's id. Waiting for the entry to land
// turns that silent no-op into a bounded, detectable timeout.
const waitForSheetMount = (knownIds: ReadonlySet<string>): Promise<boolean> =>
    new Promise(resolve => {
        let settled = false
        const finish = (mounted: boolean) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            unsubscribe()
            resolve(mounted)
        }
        // Detects mount by id-set diff, which assumes every request lands
        // with a freshly generated id. If a `kind:'sheet'` catalog entry
        // ever supplies an explicit `BottomSheetRequest.id` that collides
        // with a dismissed-but-not-removed id from the previous step,
        // request() takes the replace-in-place branch, no new id appears
        // here, and this falsely reports "never mounted" even though the
        // sheet did mount. No entry does this today.
        const hasNewEntry = (requests: InternalRequest[]) =>
            requests.some(request => !knownIds.has(request.id))

        const timer = setTimeout(() => finish(false), SETTLE_TIMEOUT_MS)
        // Prefer subscribe over polling: the store already exposes a
        // change event, so reacting to it is simpler and has no arbitrary
        // poll interval to tune.
        const unsubscribe = useBottomSheetStore.subscribe(state => {
            if (hasNewEntry(state.requests)) finish(true)
        })
        // subscribe only fires on the *next* change — request() usually
        // already ran (synchronously) by the time launchGalleryEntry
        // returns, so check the current state once up front too.
        if (hasNewEntry(useBottomSheetStore.getState().requests)) finish(true)
    })

export const runTourStep = async ({
    stepId,
    locale,
}: RunTourStepParams): Promise<RunTourStepOutcome> => {
    const step = getTourStep(stepId)
    if (!step) {
        console.log(`${TOUR_ERROR_MARKER}|${stepId}|unknown step`)
        return 'unknown-step'
    }

    useBottomSheetStore.getState().dismissAll()

    // Awaited, not fire-and-forget: launching before this resolves would
    // screenshot the previous locale — a plausible-looking image that is
    // silently wrong.
    await i18n.changeLanguage(locale)

    const isSheet = isSheetLaunch(step.entry.launch.kind)
    const knownSheetIds = isSheet
        ? new Set(useBottomSheetStore.getState().requests.map(r => r.id))
        : undefined

    // Drained here too, not just once per run: a record made during the
    // previous step's CAPTURE_HOLD_MS wait (runTour) or during this step's
    // own locale switch/dismiss above would otherwise be misattributed to
    // this step's drain at the end.
    drainOverflow()

    let launchOutcome: GalleryLaunchOutcome
    try {
        launchOutcome = launchGalleryEntry(step.entry)
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        console.log(`${TOUR_ERROR_MARKER}|${stepId}|${reason}`)
        return 'launch-error'
    }

    if (launchOutcome === 'navigation-not-ready') {
        // No SHOT here: the caller (a tour deeplink arriving before
        // useAppBootstrap finishes) would otherwise get a screenshot of the
        // splash filed under this step's id.
        console.log(`${TOUR_ERROR_MARKER}|${stepId}|navigation not ready`)
        return 'navigation-not-ready'
    }

    if (knownSheetIds) {
        const mounted = await waitForSheetMount(knownSheetIds)
        if (!mounted) {
            // A screenshot of the wrong surface is worse than a reported
            // failure — the driver would file it under this step's id and
            // no one would notice it's actually the previous screen.
            console.log(`${TOUR_ERROR_MARKER}|${stepId}|sheet never mounted`)
            return 'sheet-not-mounted'
        }
    }

    await waitForSettle()

    // Only when non-empty: a clean run over ~190 steps would otherwise emit
    // an empty-array line per step that the driver has to filter out.
    const overflows = drainOverflow()
    if (overflows.length > 0) {
        console.log(
            `${TOUR_OVERFLOW_MARKER}|${stepId}|${JSON.stringify(overflows)}`,
        )
    }

    console.log(`${TOUR_SHOT_MARKER}|${stepId}`)
    return 'shot'
}
