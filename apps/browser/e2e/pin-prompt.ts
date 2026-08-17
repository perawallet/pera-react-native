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

import type { Locator, Page } from '@playwright/test'

// PromptContainer (modules/prompts) shows a one-time security nudge on a
// wall-clock delay after the account exists — dismiss it if it raced in and is
// covering a click target.
//
// Both helpers below lived as byte-identical copies in nine spec files, which
// is how the unbounded click in the dismissal went unnoticed in all nine.
export const dismissPinPromptIfPresent = async (
    targetPage: Page,
): Promise<void> => {
    const notNow = targetPage.getByTestId('pin_security_prompt_not_now_button')
    if (!(await notNow.isVisible().catch(() => false))) return
    // Bounded and swallowed, for the same reason the final click below is
    // bounded: the nudge can dismiss itself between the visibility check and
    // this click, and an untimed click then waits Playwright's default action
    // timeout for it to reappear. Called up to ten times per
    // clickThroughPinPrompt, that drains the 120s test budget while the call
    // log only ever says it is "waiting for" the prompt.
    await notNow.click({ timeout: 2000 }).catch(() => {})
}

// A single dismiss at test start is not enough: the nudge fires on its own
// wall-clock delay and can land BETWEEN clicks, where its overlay intercepts
// pointer events and a bare click() retries against it until the test times
// out.
export const clickThroughPinPrompt = async (
    targetPage: Page,
    locator: Locator,
): Promise<void> => {
    for (let attempt = 0; attempt < 5; attempt++) {
        await dismissPinPromptIfPresent(targetPage)
        const clicked = await locator
            .click({ timeout: 3000 })
            .then(() => true)
            .catch(() => false)
        if (clicked) return
        await dismissPinPromptIfPresent(targetPage)
    }
    // Bounded, not left to Playwright's unlimited default action timeout: a
    // locator that's genuinely stuck (e.g. an unrelated overlay left open by a
    // prior test) should fail this click with a clear timeout instead of
    // hanging until the whole test's timeout budget is exhausted.
    await locator.click({ timeout: 10_000 })
}

// Opportunistic dismissal is not enough once the nudge can swallow sheets.
// PERA-4870 mounted PromptContainer on this shell for the first time, and a
// pending prompt holds every NEW bottom-sheet presentation until it is
// answered (bottom-sheet `presentationHolds`). The nudge fires on a wall-clock
// delay from the moment the account exists, so it routinely lands *inside* a
// later `toBeVisible()` wait — where it silently holds the sheet the test is
// waiting for, and no `clickThroughPinPrompt` is running to clear it. The
// sheet is queued, not dropped, but the wait expires first.
//
// So specs that open sheets settle the nudge once, up front, instead of
// racing it. Bounded and swallowed: specs that never reach a funded account
// (onboarding-only flows) never raise it, and the tolerant path keeps this
// usable from any post-onboarding point.
export const settlePinPrompt = async (targetPage: Page): Promise<void> => {
    const notNow = targetPage.getByTestId('pin_security_prompt_not_now_button')
    const appeared = await notNow
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false)
    if (!appeared) return
    await notNow.click({ timeout: 5000 }).catch(() => {})
    await notNow.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {})
}
