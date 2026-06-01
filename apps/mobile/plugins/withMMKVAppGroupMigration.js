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

/*
 * Custom config plugin: one-time iOS migration of MMKV stores from the
 * pre-App-Group sandbox location into the App Group container.
 *
 * Enabling the passkey AutoFill extension sets `AppGroupIdentifier` in
 * Info.plist. react-native-mmkv reads that at runtime and roots every store
 * in the App Group container instead of `<Documents>/mmkv` — so on upgrade an
 * existing install opens an empty keystore + empty client state (the files are
 * still in the old sandbox path, just no longer where MMKV looks).
 *
 * This injects a copy step into AppDelegate `didFinishLaunchingWithOptions`
 * that runs BEFORE the RN bridge loads the JS bundle (which is what opens
 * MMKV), so the relocated files are in place before the first read. The
 * keystore's master key lives in the Keychain (survives upgrades independent
 * of the App Group), so the copied encrypted blobs stay decryptable.
 *
 * After copying, it DELETES the legacy sandbox store. That absence is the
 * idempotency signal (no marker file) and, crucially, stops the old data from
 * resurfacing after an in-app "remove all data" wipe — that clears the App
 * Group store but not the sandbox dir, so a lingering legacy store would get
 * re-migrated on the next launch. iOS-only; Android keeps MMKV in the app
 * sandbox and needs no migration.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withDangerousMod } = require('expo/config-plugins');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const CALL = 'migrateMMKVToAppGroupIfNeeded()';

// Top-level Swift function. Foundation symbols (FileManager, Bundle, NSLog) are
// available via the existing Expo/UIKit imports — no extra import needed (which
// also avoids the import access-level rewrite in withPublicSwiftImports).
const FUNCTION = `// @pera begin mmkv-appgroup-migration
/// One-time migration of MMKV stores from the pre-App-Group sandbox path
/// (\`<Documents>/mmkv\`) into the App Group container. See
/// plugins/withMMKVAppGroupMigration.js. Runs before the RN bridge opens MMKV;
/// deletes the legacy store after copying so it can never resurface (no marker
/// file — the legacy dir's absence is the "already migrated" signal).
func ${CALL.replace('()', '')}() {
  let fileManager = FileManager.default

  // No App Group configured → MMKV stays in the sandbox, nothing to migrate.
  guard let appGroupID = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String else {
    return
  }
  guard let containerURL = fileManager.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) else {
    return
  }
  guard let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
    return
  }

  let legacyDir = documentsURL.appendingPathComponent("mmkv", isDirectory: true)
  var isDirectory: ObjCBool = false
  let legacyExists = fileManager.fileExists(atPath: legacyDir.path, isDirectory: &isDirectory)
  guard legacyExists && isDirectory.boolValue else {
    return  // No legacy store → nothing to do (fresh install or already migrated).
  }

  do {
    let entries = try fileManager.contentsOfDirectory(at: legacyDir, includingPropertiesForKeys: nil)
    for source in entries {
      let destination = containerURL.appendingPathComponent(source.lastPathComponent)
      // Never clobber data already in the App Group store.
      if fileManager.fileExists(atPath: destination.path) {
        continue
      }
      try fileManager.copyItem(at: source, to: destination)
    }
    // Delete the legacy store only after every file copied without error, so a
    // partial failure leaves it intact to retry on the next launch.
    try fileManager.removeItem(at: legacyDir)
  } catch {
    NSLog("[Pera] MMKV App Group migration failed: \\(error.localizedDescription)")
  }
}
// @pera end mmkv-appgroup-migration

`

/**
 * Injects the migration function + its call into AppDelegate.swift contents.
 * Pure (string → string) and idempotent so it can be unit-checked or run from a
 * one-off script without a full prebuild. Throws if either anchor is missing,
 * so a silently no-op'd migration can't slip through (the Swift template
 * changing out from under us must fail loudly).
 *
 * @param {string} contents AppDelegate.swift source
 * @returns {string} transformed source
 */
function injectMigration(contents) {
  if (contents.includes(CALL)) {
    return contents; // Already injected (e.g. prebuild without --clean).
  }

  const withFunction = contents.replace(
    /(@main\s*\n\s*class AppDelegate)/,
    `${FUNCTION}$1`
  );
  if (withFunction === contents) {
    throw new Error(
      'withMMKVAppGroupMigration: could not find the `@main class AppDelegate` anchor'
    );
  }

  // Insert the call as the first statement of didFinishLaunchingWithOptions,
  // before the JS bundle is loaded by factory.startReactNative(...).
  const withCall = withFunction.replace(
    /(didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\n\s*\) -> Bool \{\n)/,
    `$1    ${CALL}\n`
  );
  if (withCall === withFunction) {
    throw new Error(
      'withMMKVAppGroupMigration: could not find the didFinishLaunchingWithOptions anchor'
    );
  }

  return withCall;
}

const withMMKVAppGroupMigration = (config) => {
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

      fs.writeFileSync(appDelegatePath, injectMigration(contents));

      return modConfig;
    },
  ]);
};

module.exports = withMMKVAppGroupMigration;
module.exports.injectMigration = injectMigration;
