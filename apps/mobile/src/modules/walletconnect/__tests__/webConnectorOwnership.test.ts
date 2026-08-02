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

// Static backstop for the core property this task establishes: on web, the
// offscreen document (apps/mobile/src/offscreen/walletconnect/wcHost.ts) is
// the SOLE owner of WalletConnect connectors — no other module may
// construct, register, or bind one.
//
// I-3: this used to be a blocklist — it only grepped `.web.ts`/`.web.tsx`
// files under apps/mobile/src for a literal `useWalletConnect(` call. A
// reviewer proved the hole by adding a `useWalletConnect(...)` call to
// apps/mobile/src/modules/dapp/hooks/useDappRequest.ts — the extension's own
// approval surface, unambiguously web-reachable — and it went entirely
// undetected: that file is neither a `.web` twin nor one of the six
// grandfathered call sites the old test happened to name. Any new shared
// hook consumed by a web surface lands in that unguarded category by
// default, which is the worst kind of blind spot for an architecture whose
// central claim is "everything outside a short allowlist is safe by
// construction." The old scan also never covered packages/*/src, and being
// purely textual it would miss `import { useWalletConnect as useWC }` or a
// re-export.
//
// Fixed by inverting the check: scan every non-test source file under
// apps/mobile/src AND packages/*/src for any connector-ownership call, and
// assert the offender set EQUALS an explicit allowlist. A new file that
// constructs/registers/binds a connector is now a failure by default,
// not invisible by default.
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// vitest's root for this package is apps/mobile/ (see vitest.config.ts), so
// resolve relative to the process cwd rather than import.meta.url/__dirname
// — the same reasoning as apps/browser/src/content/__tests__/manifest.test.ts.
const MOBILE_SRC_ROOT = join(process.cwd(), 'src')
const REPO_ROOT = join(process.cwd(), '..', '..')
const PACKAGES_ROOT = join(REPO_ROOT, 'packages')
// apps/mobile/src + packages/*/src alone would miss apps/browser/src (the
// service worker, content scripts, and the offscreen HTML entry) and every
// extensions/*/src (platform-chrome et al.) — both web-reachable by
// construction, exactly the category this allowlist exists to guard.
// Scanning them too (confirmed zero legitimate owners live there today, so
// ALLOWED_CONNECTOR_OWNERS itself is unchanged) closes that gap.
const APPS_EXTENSION_SRC_ROOT = join(REPO_ROOT, 'apps', 'extension', 'src')
const EXTENSIONS_ROOT = join(REPO_ROOT, 'extensions')

// The four call shapes that create or bind a live WC v1 connector.
// `\b...\(` (not just the bare name) so this doesn't false-positive on a
// similarly-named export — `useWalletConnectPairing(`,
// `useWalletConnectSessionsControl(`, `useWalletConnectStore(`,
// `useWalletConnectSessionRequests(` all have more characters between
// `useWalletConnect` and `(` and so don't match.
const CONNECTOR_OWNERSHIP_PATTERNS = [
    /\bnew WalletConnect\(/,
    /\bregisterConnector\(/,
    /\bsetConnectorHandlerBinder\(/,
    /\buseWalletConnect\(/,
]

// Test/test-infrastructure files are exempt: they exercise ownership code
// (fixtures, stubs, mocks) without themselves being a module the web bundle
// ships. `test-utils/` covers e.g. the `WalletConnect` class stub vitest
// aliases `@perawallet/walletconnect` to for the whole repo.
const TEST_DIR_SEGMENTS = [
    '__tests__',
    '__mocks__',
    'test-utils',
    '__integration__',
]
const TEST_FILE_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']

const isTestFile = (path: string): boolean => {
    const segments = path.split(sep)
    if (TEST_DIR_SEGMENTS.some(segment => segments.includes(segment))) {
        return true
    }
    return TEST_FILE_SUFFIXES.some(suffix => path.endsWith(suffix))
}

const listFilesRecursively = (dir: string): string[] => {
    if (!existsSync(dir)) return []
    return readdirSync(dir).flatMap(entry => {
        const fullPath = join(dir, entry)
        return statSync(fullPath).isDirectory()
            ? listFilesRecursively(fullPath)
            : [fullPath]
    })
}

const listPackageSrcRoots = (): string[] => {
    if (!existsSync(PACKAGES_ROOT)) return []
    return readdirSync(PACKAGES_ROOT)
        .map(name => join(PACKAGES_ROOT, name, 'src'))
        .filter(existsSync)
}

const listExtensionsSrcRoots = (): string[] => {
    if (!existsSync(EXTENSIONS_ROOT)) return []
    return readdirSync(EXTENSIONS_ROOT)
        .map(name => join(EXTENSIONS_ROOT, name, 'src'))
        .filter(existsSync)
}

const toRepoRelativePosixPath = (path: string): string =>
    relative(REPO_ROOT, path).split(sep).join('/')

// The complete, explicit set of files permitted to own a WalletConnect v1
// connector. Enumerated by hand against the actual call sites for each
// pattern, not copied from any prior claim about what "should" be here:
//   - the native provider hook and native ConnectionView (the two mobile UI
//     surfaces that legitimately drive a connector directly);
//   - the native halves of the two shared hooks this task's web twins pair
//     with (their web halves deliberately do NOT appear here);
//   - the offscreen host, the sole owner on web;
//   - packages/walletconnect's own internals — the hook the native halves
//     above delegate to, and the two connection-layer modules that
//     construct/register the real SDK class.
const ALLOWED_CONNECTOR_OWNERS = [
    'apps/mobile/src/modules/walletconnect/providers/useWalletConnectProvider.tsx',
    'apps/mobile/src/modules/walletconnect/components/ConnectionView/ConnectionView.tsx',
    'apps/mobile/src/modules/walletconnect/hooks/useWalletConnectPairing.ts',
    'apps/mobile/src/modules/walletconnect/hooks/useWalletConnectSessionsControl.ts',
    'apps/mobile/src/offscreen/walletconnect/wcHost.ts',
    'packages/walletconnect/src/hooks/useWalletConnect.ts',
    'packages/walletconnect/src/connection/createConnector.ts',
    'packages/walletconnect/src/connection/connectorRegistry.ts',
].sort()

describe('web connector ownership', () => {
    it('ConnectionView.web.tsx does not exist (its only reachable trigger was a UI-realm connector offscreen never saw)', () => {
        const path = join(
            MOBILE_SRC_ROOT,
            'modules/walletconnect/components/ConnectionView/ConnectionView.web.tsx',
        )
        expect(existsSync(path)).toBe(false)
    })

    it('every file that constructs, registers, or binds a WalletConnect connector is on the explicit allowlist — nothing more, nothing less', () => {
        const scanRoots = [
            MOBILE_SRC_ROOT,
            APPS_EXTENSION_SRC_ROOT,
            ...listPackageSrcRoots(),
            ...listExtensionsSrcRoots(),
        ]

        const offenders = scanRoots
            .flatMap(root => listFilesRecursively(root))
            .filter(path => !isTestFile(path))
            .filter(path =>
                CONNECTOR_OWNERSHIP_PATTERNS.some(pattern =>
                    pattern.test(readFileSync(path, 'utf8')),
                ),
            )
            .map(toRepoRelativePosixPath)
            .sort()

        expect(offenders).toEqual(ALLOWED_CONNECTOR_OWNERS)
    })
})
