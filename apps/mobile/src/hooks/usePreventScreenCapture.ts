/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useEffect } from 'react'
import {
    preventScreenCaptureAsync,
    allowScreenCaptureAsync,
} from 'expo-screen-capture'
import { config } from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'

// Blocks screenshots and screen recordings while the mounting component is
// alive (or while `enabled` is true), re-enabling capture on unmount or when
// `enabled` flips back to false. Fails open (permission denied) rather than
// bricking the caller — errors are logged so we notice them in crash reports.
// The `tag` is required so overlapping callers (e.g. mnemonic screen plus a
// deep-linked verification sheet) don't clobber each other's lock.
//
// The e2e escape hatch is a build-time config flag, not a remote/runtime
// signal: store builds compile `disableScreenCapturePrevention` to false, so
// nobody can weaken seed-screen protection on the live fleet.
export const usePreventScreenCapture = (
    tag: string,
    enabled: boolean = true,
): void => {
    useEffect(() => {
        if (!enabled || config.disableScreenCapturePrevention) return
        void preventScreenCaptureAsync(tag).catch(err => {
            logger.error(
                'usePreventScreenCapture: failed to prevent screen capture',
                {
                    tag,
                    error: err instanceof Error ? err.message : String(err),
                },
            )
        })
        return () => {
            void allowScreenCaptureAsync(tag).catch(err => {
                logger.error(
                    'usePreventScreenCapture: failed to re-allow screen capture',
                    {
                        tag,
                        error: err instanceof Error ? err.message : String(err),
                    },
                )
            })
        }
    }, [tag, enabled])
}
