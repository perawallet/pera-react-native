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

import { drainOverflow } from '@components/core/PWText/overflowRegistry'

import { getTourSteps } from './steps'
import { runTourStep, TOUR_ERROR_MARKER } from './runTourStep'
import type { RunTourParams, RunTourStepOutcome } from '../types'

export const TOUR_BEGIN_MARKER = 'LOCALE_TOUR_BEGIN'
export const TOUR_DONE_MARKER = 'LOCALE_TOUR_DONE'

// Consecutive, not total: one bad catalog entry that unmounts the root (e.g.
// a screen destructuring required route params it never got) makes every
// later `navigate` step return this same outcome, turning one crash into a
// wall of unrelated-looking errors. Past this many in a row, the run stops
// itself instead of grinding through the remainder — see NAVIGATION_LOST_REASON.
const NAVIGATION_LOST_THRESHOLD = 3

// Read verbatim by locale-tour.mjs to recognize the cascade and report it as
// one event ("navigation died at step N") instead of a list of ids — keep
// the two in sync.
export const NAVIGATION_LOST_REASON =
    'navigation lost — remaining steps unreliable'

// `xcrun simctl io screenshot` measured 170-340ms to produce a file on the
// reference simulator — the driver captures *after* seeing
// LOCALE_TOUR_SHOT, but nothing otherwise stops the app from advancing to the
// next surface before that capture lands, so ~31% of screenshots in that run
// risked showing the wrong step. 700ms is ~2x the observed worst case. An
// inbound driver->app ack channel was considered and rejected on the same
// security grounds that ruled out inbound deeplink listeners; holding here is
// the only side that can actually keep a surface on screen.
export const CAPTURE_HOLD_MS = 700

const wait = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms))

/**
 * Drives every tour step for one locale behind a single deeplink. Exists
 * because `xcrun simctl openurl` raises an OS "Open in Pera?" confirmation
 * on every call — one deeplink per step would mean 190 taps per locale per
 * device; this reduces it to one.
 */
export const runTour = async ({
    locale,
    categories,
}: RunTourParams): Promise<void> => {
    const steps = getTourSteps(categories)
    console.log(`${TOUR_BEGIN_MARKER}|${steps.length}|${locale}`)

    // Discards anything recorded before the deeplink's navigation landed
    // (e.g. during the splash/bootstrap the surface list can't distinguish
    // from step 1) — without this, those pre-tour records get attributed to
    // whichever step happens to drain the map first.
    drainOverflow()

    let consecutiveNavigationNotReady = 0

    for (const step of steps) {
        let outcome: RunTourStepOutcome | undefined
        try {
            outcome = await runTourStep({ stepId: step.id, locale })
        } catch (error) {
            // runTourStep already turns per-step failures into an ERR
            // marker without throwing; this only guards against an
            // unexpected rejection so one bad surface can never take down
            // the other 189.
            const reason =
                error instanceof Error ? error.message : String(error)
            console.log(`${TOUR_ERROR_MARKER}|${step.id}|${reason}`)
        }

        if (outcome === 'navigation-not-ready') {
            consecutiveNavigationNotReady += 1
            if (consecutiveNavigationNotReady >= NAVIGATION_LOST_THRESHOLD) {
                console.log(
                    `${TOUR_ERROR_MARKER}|${step.id}|${NAVIGATION_LOST_REASON}`,
                )
                break
            }
        } else {
            consecutiveNavigationNotReady = 0
        }

        // Only here, not inside runTourStep: the interactive single-step path
        // has a human already looking at the screen, so a pause there would
        // just be dead time with nothing to protect.
        await wait(CAPTURE_HOLD_MS)
    }

    console.log(TOUR_DONE_MARKER)
}
