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

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const listFilesRecursively = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return listFilesRecursively(path)
        return entry.name.endsWith('.ts') ? [path] : []
    })

describe('keystore-chrome decoupling', () => {
    it('imports nothing from the @algorandfoundation/keystore meta package', () => {
        const files = listFilesRecursively(join(__dirname, '..'))
        // A rename or a wrong root must not silently reduce this to a no-op pass.
        expect(files.length).toBeGreaterThan(0)
        const offenders = files.filter(file =>
            /from ['"]@algorandfoundation\/keystore['"]/.test(
                readFileSync(file, 'utf8'),
            ),
        )
        expect(offenders).toEqual([])
    })
})
