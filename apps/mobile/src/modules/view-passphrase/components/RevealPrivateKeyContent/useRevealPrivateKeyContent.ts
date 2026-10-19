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

import { useEffect } from 'react'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'

const SCREEN_CAPTURE_TAG = 'reveal-private-key'

export type UseRevealPrivateKeyContentParams = {
    privateKey: Uint8Array
}

export const useRevealPrivateKeyContent = ({
    privateKey,
}: UseRevealPrivateKeyContentParams): void => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG, true)

    // The sheet can unmount before its request settles (a dismissAll, the
    // last host going away), so the bytes are zeroed here too.
    useEffect(() => () => zeroBytes(privateKey), [privateKey])
}
