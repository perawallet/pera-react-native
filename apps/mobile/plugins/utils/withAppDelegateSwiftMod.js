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
 * Shared iOS AppDelegate.swift mod: read the file, run `transform(contents)`,
 * write the result back. Several config plugins inject Swift into the same file
 * via this identical read-transform-write dance — this centralizes it so each
 * plugin only supplies its pure string transform.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withDangerousMod } = require('expo/config-plugins');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const withAppDelegateSwiftMod = (config, transform) => {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const appDelegatePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        modConfig.modRequest.projectName,
        'AppDelegate.swift'
      );

      // Read-then-catch rather than existsSync+read: avoids a check/use race
      // (CodeQL js/file-system-race) and survives prebuild runs that haven't
      // yet materialized the iOS project.
      let contents;
      try {
        contents = fs.readFileSync(appDelegatePath, 'utf-8');
      } catch (err) {
        if (err.code === 'ENOENT') {
          return modConfig;
        }
        throw err;
      }

      fs.writeFileSync(appDelegatePath, transform(contents));

      return modConfig;
    },
  ]);
};

module.exports = withAppDelegateSwiftMod;
