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

import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const ASSETS = path.join(__dirname, '..', 'assets', 'production')

describe('production icon assets', () => {
    it('iOS marketing icon is 1024² and fully opaque (App Store requires no alpha)', async () => {
        const meta = await sharp(path.join(ASSETS, 'icon-ios.png')).metadata()
        expect(meta.width).toBe(1024)
        expect(meta.height).toBe(1024)
        expect(meta.hasAlpha).toBe(false)
    })

    it('Android adaptive foreground is 1024² and transparent', async () => {
        const meta = await sharp(
            path.join(ASSETS, 'icon-android-foreground.png'),
        ).metadata()
        expect(meta.width).toBe(1024)
        expect(meta.height).toBe(1024)
        expect(meta.hasAlpha).toBe(true)
    })
})
