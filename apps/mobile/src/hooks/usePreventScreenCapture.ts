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

import { useEffect, useState } from 'react'
import {
    preventScreenCaptureAsync,
    allowScreenCaptureAsync,
} from 'expo-screen-capture'
import { config } from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'

// One shared native lock, ref-counted in JS (prevent on 0->1, allow on 1->0):
// expo fires a native prevent per DISTINCT tag and iOS `preventScreenshots()`
// isn't idempotent, so overlapping screens with different tags black-screened.
export const SECURE_SCREEN_CAPTURE_TAG = 'pera-secure-screen'

let activeHolders = 0
let captureLock: Promise<void> = Promise.resolve()

const acquireCaptureLock = (tag: string): Promise<void> => {
    activeHolders += 1
    if (activeHolders === 1) {
        captureLock = preventScreenCaptureAsync(
            SECURE_SCREEN_CAPTURE_TAG,
        ).catch(err => {
            // The Expo module or Android's FLAG_SECURE refusing is a device
            // condition, not a defect we can fix from here.
            logger.warn(
                'usePreventScreenCapture: failed to prevent screen capture',
                {
                    tag,
                    error: err instanceof Error ? err.message : String(err),
                },
            )
        })
    }
    return captureLock
}

const releaseCaptureLock = (tag: string): void => {
    activeHolders = Math.max(0, activeHolders - 1)
    if (activeHolders !== 0) return
    void allowScreenCaptureAsync(SECURE_SCREEN_CAPTURE_TAG).catch(err => {
        // The Expo module or Android's FLAG_SECURE refusing is a device
        // condition, not a defect we can fix from here.
        logger.warn(
            'usePreventScreenCapture: failed to re-allow screen capture',
            { tag, error: err instanceof Error ? err.message : String(err) },
        )
    })
}

// Blocks screenshots and screen recordings while the mounting component is
// alive (or while `enabled` is true), re-enabling capture on unmount or when
// `enabled` flips back to false. Fails open (permission denied) rather than
// bricking the caller. A refusal is a device condition, so it is logged at
// `warn` and deliberately never reported as a crash-reporting non-fatal.
// The `tag` only labels the caller in those logs; the native lock is shared
// and ref-counted (see above), so overlapping callers never double-lock it.
//
// The e2e escape hatch is a build-time config flag, not a remote/runtime
// signal: store builds compile `disableScreenCapturePrevention` to false, so
// nobody can weaken seed-screen protection on the live fleet.
//
// Returns true once the native call has settled — including when it was
// refused or skipped. A caller that opens its own OS window (an RN `<Modal>`)
// must hold that window back until then: Android copies FLAG_SECURE into a
// dialog's window only while creating it, and never afterwards.
export const usePreventScreenCapture = (
    tag: string,
    enabled: boolean = true,
): boolean => {
    const [isLockSettled, setIsLockSettled] = useState(false)

    useEffect(() => {
        if (!enabled) return
        if (config.disableScreenCapturePrevention) {
            setIsLockSettled(true)
            return
        }
        let isHolding = true
        void acquireCaptureLock(tag).then(() => {
            if (isHolding) setIsLockSettled(true)
        })
        return () => {
            isHolding = false
            setIsLockSettled(false)
            releaseCaptureLock(tag)
        }
    }, [tag, enabled])

    return isLockSettled
}
