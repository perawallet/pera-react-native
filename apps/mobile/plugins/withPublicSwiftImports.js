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

/*
 * Custom config plugin to add explicit `public` access level to Swift imports
 * in AppDelegate.swift. Required for Xcode 26+ / Swift 6.2 which enforces
 * SE-0409 (access-level modifiers on import declarations).
 *
 * Without this, bare `import Foo` is implicitly `internal`, which conflicts
 * with the `public class AppDelegate` declaration.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withAppDelegateSwiftMod = require('./utils/withAppDelegateSwiftMod');

// Replace bare `import X` with `public import X` at the top of the file, but
// only for lines that don't already have an access level modifier.
const injectPublicImports = (contents) =>
  contents.replace(
    /^(?!(?:public|internal|private|fileprivate|package)\s+import\b)(import\s+\w+)/gm,
    'public $1'
  );

const withPublicSwiftImports = (config) =>
  withAppDelegateSwiftMod(config, injectPublicImports);

module.exports = Object.assign(withPublicSwiftImports, { injectPublicImports });
