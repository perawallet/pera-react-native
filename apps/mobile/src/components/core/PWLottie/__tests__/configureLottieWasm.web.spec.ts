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

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@lottiefiles/dotlottie-react', () => ({ setWasmUrl: vi.fn() }))

describe('configureLottieWasm.web', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('points dotlottie at the extension-bundled wasm on import', async () => {
        vi.stubGlobal('chrome', {
            runtime: {
                getURL: (path: string) => `chrome-extension://pera/${path}`,
            },
        })

        await import('../configureLottieWasm.web')

        const { setWasmUrl } = await import('@lottiefiles/dotlottie-react')
        expect(setWasmUrl).toHaveBeenCalledWith(
            'chrome-extension://pera/dotlottie-player.wasm',
        )
    })
})
