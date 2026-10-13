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

/**
 * chrome.storage.session: the flow the toolbar popup handed to a tab
 * (`expanded.html?flow=resume`). Session storage because the popup and the tab
 * share no memory, and the popup is gone by the time the tab reads it.
 */
export const TAB_RESUME_SESSION_KEY = 'tab-resume:intent'

// Session storage defaults to TRUSTED_CONTEXTS, so content scripts can't read it.
export const putTabResumeIntent = async (intent: unknown): Promise<void> => {
    await chrome.storage.session.set({ [TAB_RESUME_SESSION_KEY]: intent })
}

/** Reads and removes the handed-over intent, so a reload doesn't replay it. */
export const takeTabResumeIntent = async (): Promise<unknown> => {
    const stored = await chrome.storage.session.get(TAB_RESUME_SESSION_KEY)
    await chrome.storage.session.remove(TAB_RESUME_SESSION_KEY)
    return stored[TAB_RESUME_SESSION_KEY] ?? null
}

/** chrome.storage.session: the toast the reopened popup shows for the tab's flow. */
export const TAB_RESUME_RESULT_SESSION_KEY = 'tab-resume:result'

/** Runtime message a resume tab sends when its flow succeeded. */
export const TAB_RESUME_DONE_SCOPE = 'tab-resume:done'

export const isTabResumeDoneMessage = (message: unknown): boolean =>
    (message as { scope?: unknown } | null)?.scope === TAB_RESUME_DONE_SCOPE

/**
 * Stores the popup's toast, then asks the service worker to close this tab and
 * reopen the popup. The worker does both: a tab that closes itself dies before
 * it could open the popup.
 */
export const finishTabResume = async (result: unknown): Promise<void> => {
    await chrome.storage.session.set({
        [TAB_RESUME_RESULT_SESSION_KEY]: {
            ...(result as object),
            createdAt: Date.now(),
        },
    })
    await chrome.runtime.sendMessage({ scope: TAB_RESUME_DONE_SCOPE })
}

/** Reads and removes the toast, so a later popup open doesn't repeat it. */
export const takeTabResumeResult = async (): Promise<unknown> => {
    const stored = await chrome.storage.session.get(
        TAB_RESUME_RESULT_SESSION_KEY,
    )
    await chrome.storage.session.remove(TAB_RESUME_RESULT_SESSION_KEY)
    return stored[TAB_RESUME_RESULT_SESSION_KEY] ?? null
}
