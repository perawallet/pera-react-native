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

// Native counterpart to `webConnectorOwnership.test.ts`. Web's claim is
// "offscreen is the sole owner of connectors"; native's is narrower but the
// same shape — several surfaces may legitimately hold a `useWalletConnect`
// (pairing, the approval sheet, the settings session list), but exactly ONE
// of them may own the dApp REQUEST HANDLERS a connector's out-of-React event
// listeners call into. Those listeners read the handlers through refs that
// only re-render refreshes, so an owner that unmounts freezes the session on
// whatever account/network state it last saw.
//
// Inverted like the web scan, for the same reason: a new surface that opts
// into ownership must be a failure by default rather than invisible by
// default. Scanned over the same wider root set the web test uses (mobile +
// packages/*/src + apps/browser/src + extensions/*/src) — a `packages/*`
// hook opting in would otherwise be invisible to a mobile-only scan, exactly
// the hole `webConnectorOwnership.test.ts`'s header documents a reviewer
// proving against a narrower version of that scan.
//
// `setConnectorHandlerBinder(` direct-registration coverage lives solely in
// `webConnectorOwnership.test.ts`, which already scans it over this same
// wider root set — duplicating it here would just be a weaker, mobile-only
// copy of that assertion.
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// vitest's root for this package is apps/mobile/ (see vitest.config.ts).
const MOBILE_SRC_ROOT = join(process.cwd(), 'src')
const REPO_ROOT = join(process.cwd(), '..', '..')
const PACKAGES_ROOT = join(REPO_ROOT, 'packages')
const APPS_BROWSER_SRC_ROOT = join(REPO_ROOT, 'apps', 'browser', 'src')
const EXTENSIONS_ROOT = join(REPO_ROOT, 'extensions')

const OWNERSHIP_OPT_IN = /\bownsRequestHandlers\b/

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

const scanSources = (pattern: RegExp): string[] => {
    const scanRoots = [
        MOBILE_SRC_ROOT,
        APPS_BROWSER_SRC_ROOT,
        ...listPackageSrcRoots(),
        ...listExtensionsSrcRoots(),
    ]

    return scanRoots
        .flatMap(root => listFilesRecursively(root))
        .filter(path => !isTestFile(path))
        .filter(path => pattern.test(readFileSync(path, 'utf8')))
        .map(toRepoRelativePosixPath)
        .sort()
}

// `useWalletConnectProvider` is mounted once from `RootComponent` and lives
// for the whole app session. Every other native `useWalletConnect` call site
// is transient — `ConnectionView` is a bottom sheet, the pairing hook is
// reached from every screen layout, the sessions-control hook from settings
// screens — so none of them may claim ownership.
//
// The other two entries are the option's own definition/doc sites, not
// opt-in call sites: `useWalletConnect.ts` declares and reads
// `ownsRequestHandlers`, and `connectorRegistry.ts` names it in a doc
// comment. The regex has no way to tell "declares this option" from "passes
// it `true`" — same reason `webConnectorOwnership.test.ts`'s allowlist
// includes these files too.
const ALLOWED_REQUEST_HANDLER_OWNERS = [
    'apps/mobile/src/modules/walletconnect/providers/useWalletConnectProvider.tsx',
    'packages/walletconnect/src/connection/connectorRegistry.ts',
    'packages/walletconnect/src/hooks/useWalletConnect.ts',
].sort()

describe('native request-handler ownership', () => {
    it('only the persistent WalletConnect provider opts into owning the dApp request handlers', () => {
        expect(scanSources(OWNERSHIP_OPT_IN)).toEqual(
            ALLOWED_REQUEST_HANDLER_OWNERS,
        )
    })
})
