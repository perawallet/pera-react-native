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

// Web twin of shareText.
//
// The native path goes through react-native-share, whose web shim throws when
// `navigator.share` is absent — which is the norm on `chrome-extension://`
// pages. Two of the three call sites swallowed that error and one left it
// unhandled, so the Share buttons on contacts, the contact QR sheet, and
// collectibles were simply dead with no feedback.
//
// Copying to the clipboard is the honest fallback: the user asked to send this
// text somewhere, and the clipboard is the one destination always available.
// The caller's existing success toast then tells the truth either way.
import type { ShareTextOptions } from './shareText'

/**
 * Composes the share payload into the single string the clipboard can carry.
 * `Share.open` renders message and url as separate fields; a clipboard write
 * has one slot, so they are joined rather than one silently dropped.
 */
const flatten = ({ message, url }: ShareTextOptions): string =>
    url ? `${message}\n${url}` : message

export const shareText = async (options: ShareTextOptions): Promise<void> => {
    const { message, title, url } = options

    // Present on Android Chrome and in some desktop configurations. Prefer it
    // when available so the user gets the real OS share sheet.
    if (typeof navigator !== 'undefined' && navigator.share) {
        try {
            await navigator.share({ text: message, title, url })
            return
        } catch (error) {
            // AbortError is the user dismissing the sheet — a completed
            // interaction, not a failure, and must NOT fall through to a
            // surprise clipboard write. Anything else means the sheet was
            // unavailable after all, so the fallback below still applies.
            if (error instanceof Error && error.name === 'AbortError') return
        }
    }

    await navigator.clipboard.writeText(flatten(options))
}
