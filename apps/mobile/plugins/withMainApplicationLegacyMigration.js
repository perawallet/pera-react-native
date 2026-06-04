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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {withMainApplication} = require('@expo/config-plugins');

const PACKAGE_FQN = 'com.algorand.perarn.migration.bridge.LegacyMigrationPackage';
const PACKAGE_CLASS = 'LegacyMigrationPackage';
const IMPORT_LINE = `import ${PACKAGE_FQN}`;
const REGISTER_CALL = `add(${PACKAGE_CLASS}())`;

const IMPORT_RE = /^import .+$/gm;
const APPLY_BLOCK_RE = /(PackageList\(this\)\.packages\.apply\s*\{)([^}]*)(\})/;
const BARE_PACKAGES_RE = /PackageList\(this\)\.packages(?!\.apply)/;

const patchMainApplication = (contents) => addRegistration(addImport(contents));

const withMainApplicationLegacyMigration = (config) =>
    withMainApplication(config, (config) => {
        assertKotlin(config.modResults);
        config.modResults.contents = patchMainApplication(config.modResults.contents);
        return config;
    });

const assertKotlin = (modResults) => {
    if (modResults.language !== 'kt') {
        fail(`unsupported MainApplication language "${modResults.language}" — expected "kt".`);
    }
};

const addImport = (contents) => {
    if (hasImport(contents)) return contents;
    const insertAt = findLastImportEnd(contents);
    if (insertAt === -1) {
        fail('no `import` statements found — cannot place migration import.');
    }
    return `${contents.slice(0, insertAt)}\n${IMPORT_LINE}${contents.slice(insertAt)}`;
};

const hasImport = (contents) => contents.includes(IMPORT_LINE);

const findLastImportEnd = (contents) => {
    let end = -1;
    for (const match of contents.matchAll(IMPORT_RE)) {
        end = match.index + match[0].length;
    }
    return end;
};

const addRegistration = (contents) => {
    if (hasRegistration(contents)) return contents;
    if (APPLY_BLOCK_RE.test(contents)) return addToExistingApplyBlock(contents);
    if (BARE_PACKAGES_RE.test(contents)) return wrapBarePackagesInApplyBlock(contents);
    fail('could not find `PackageList(this).packages` — Expo template may have changed.');
};

const hasRegistration = (contents) => contents.includes(REGISTER_CALL);

const addToExistingApplyBlock = (contents) =>
    contents.replace(APPLY_BLOCK_RE, (_full, opener, body, closer) => {
        const trimmed = body.replace(/\s*$/, '');
        return `${opener}${trimmed}\n          ${REGISTER_CALL}\n        ${closer}`;
    });

const wrapBarePackagesInApplyBlock = (contents) =>
    contents.replace(
        BARE_PACKAGES_RE,
        `PackageList(this).packages.apply {\n          // Packages that cannot be autolinked yet can be added manually here.\n          ${REGISTER_CALL}\n        }`,
    );

const fail = (message) => {
    throw new Error(`[withMainApplicationLegacyMigration] ${message}`);
};

module.exports = withMainApplicationLegacyMigration;
module.exports.patchMainApplication = patchMainApplication;
