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

// @vitest-environment node
import { describe, expect, test, vi } from 'vitest'

// Pins the on-device accessor's EAGER import, which is the inverse of the
// laziness `pqImportSideEffects.spec.ts` requires of every other path — see
// that file for why the two coexist.
//
// The eagerness is forced, not preferred. `packages/kms` ships a library build,
// and rolldown rewrites a `require` of an external into its own runtime shim.
// Metro's `collectDependencies` only records a dependency when the callee is
// literally `require`, so a lazy shape leaves the specifier as a dead string:
// the native module never enters the bundle graph and the shim throws on first
// use. A static import emits a real `import … from`, which Metro resolves.
//
// Guarded here because nothing else can catch a regression to the lazy form:
// vitest resolves `./falconModule` to the OFF-device file, so a revert would
// keep every other spec green while shipping a broken on-device bundle.
const evaluated = vi.hoisted(() => vi.fn())

vi.mock('@joe-p/react-native-falcon', () => {
    evaluated()
    return {
        FalconModule: {
            publicKeySize: 1793,
            generateKey: () => ({
                publicKey: new ArrayBuffer(1793),
                privateKey: new ArrayBuffer(2305),
            }),
        },
    }
})

describe('on-device Falcon module accessor', () => {
    test('resolves the native module at import time, not on first call', async () => {
        expect(evaluated).not.toHaveBeenCalled()

        const { getFalconModule } = await import('../falconModule.native')

        // Importing alone must have pulled the module in. If this fails, the
        // accessor went back to a lazy `require` and the on-device bundle would
        // ship a dead specifier.
        expect(evaluated).toHaveBeenCalled()
        expect(getFalconModule().publicKeySize).toBe(1793)
    })
})
