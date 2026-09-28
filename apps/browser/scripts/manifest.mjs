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

// The store listing shows this, so only non-production builds get a suffix.
const DESCRIPTION_SUFFIXES = {
    development: ' (development build)',
    staging: ' (staging build)',
}

const MAX_VERSION_PART = 65_535

/**
 * Chrome wants 1-4 dot-separated integers (each at most 65535) and refuses a
 * store upload that isn't higher than the last, so a pre-release tag such as
 * `-alpha.1` moves to `version_name`, which is display-only.
 */
export const toChromeVersion = packageVersion => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(
        packageVersion,
    )
    const parts = match?.slice(1) ?? []
    const isValid =
        parts.length === 3 &&
        parts.every(
            part =>
                Number(part) <= MAX_VERSION_PART &&
                (part === '0' || !part.startsWith('0')),
        )
    if (!isValid) {
        throw new Error(
            `apps/browser/package.json version "${packageVersion}" is not ` +
                'MAJOR.MINOR.PATCH with an optional -prerelease tag',
        )
    }
    return parts.join('.')
}

export const stampManifest = (manifest, { packageVersion, appEnvironment }) => {
    const version = toChromeVersion(packageVersion)
    return {
        ...manifest,
        version,
        ...(version === packageVersion ? {} : { version_name: packageVersion }),
        description:
            manifest.description + (DESCRIPTION_SUFFIXES[appEnvironment] ?? ''),
    }
}

/**
 * Throws when a production build would ship without what it needs. Runs
 * before the bundle so a misconfigured release fails in seconds.
 */
export const assertReleaseEnv = ({ appEnvironment, hasBackendApiKey }) => {
    if (appEnvironment === 'production' && !hasBackendApiKey) {
        throw new Error(
            'BACKEND_API_KEY is empty in a production build; every Pera ' +
                'backend call would fail',
        )
    }
}

export const assertStampedManifest = (manifest, { appEnvironment }) => {
    if (
        appEnvironment === 'production' &&
        /development|staging/i.test(manifest.description)
    ) {
        throw new Error(
            `production manifest description is "${manifest.description}"`,
        )
    }
}
