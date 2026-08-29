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
 * Custom config plugin: exclude the local data stores from iOS device/iCloud
 * backups (NSURLIsExcludedFromBackupKey). Android parity already exists via
 * `allowBackup: false` in app.config.js.
 *
 * Why: the default MMKV store (Zustand client state + React Query cache) and
 * `pera.db` (full tx history, balances, contact names, card last-4) are not
 * encrypted at the app level. iOS encrypts them at rest on a locked device,
 * but an *unencrypted* iTunes/Finder backup copies them to a computer in
 * cleartext. Excluding them from backup closes that vector. (App-level
 * encryption — SQLCipher / encrypted MMKV — was evaluated and deliberately
 * deferred; see the security-review ticket. This is the high-value, low-cost
 * mitigation.)
 *
 * `NSURLIsExcludedFromBackupKey` is a per-URL resource value set at runtime
 * (not an Info.plist toggle), so this injects a Swift helper into AppDelegate
 * `didFinishLaunchingWithOptions`. It marks:
 *   - `<Documents>/SQLite`  — expo-sqlite's default dir (pera.db + -wal/-shm)
 *   - the MMKV store location — the App Group container when AppGroupIdentifier
 *     is set, else `<Documents>/mmkv`
 * The dirs are created first (no-op if present) so the flag sticks from the
 * first launch, before MMKV / expo-sqlite create them. Idempotent and cheap,
 * so it runs every launch. iOS-only.
 *
 * On Android it sets `allowBackup=false` AND exclude-all `dataExtractionRules`
 * (API 31+, incl. device-transfer) + `fullBackupContent` (pre-31) so
 * backups/transfers never copy the local stores — parity with native.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withAppDelegateSwiftMod = require('./utils/withAppDelegateSwiftMod');
/* eslint-disable @typescript-eslint/no-require-imports */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

const CALL = 'excludePeraDataFromBackupIfNeeded()';

// Top-level Swift function. Foundation symbols (FileManager, Bundle, URL,
// URLResourceValues, NSLog) are available via the existing Expo/UIKit imports
// — no extra import needed.
const FUNCTION = `// @pera begin exclude-data-from-backup
/// Marks the local data stores as excluded from iOS backups
/// (NSURLIsExcludedFromBackupKey). See plugins/withExcludeDataFromBackup.js.
/// Runs every launch; idempotent. Creates each dir first so the flag sticks
/// before MMKV / expo-sqlite create them.
func ${CALL.replace('()', '')}() {
  let fileManager = FileManager.default
  var targets: [URL] = []

  if let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
    // expo-sqlite default dir — holds pera.db and its -wal/-shm sidecars.
    targets.append(documentsURL.appendingPathComponent("SQLite", isDirectory: true))
    // MMKV sandbox location used when no App Group is configured.
    targets.append(documentsURL.appendingPathComponent("mmkv", isDirectory: true))
  }

  // MMKV roots its stores in the App Group container when AppGroupIdentifier
  // is set. Exclude the whole container — it
  // holds only app-private sensitive state.
  if let appGroupID = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
     let containerURL = fileManager.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) {
    targets.append(containerURL)
  }

  for target in targets {
    // Create if missing so the flag is set before the store libraries create
    // the dir on first use. No-op when it already exists (incl. the App Group
    // container root).
    try? fileManager.createDirectory(at: target, withIntermediateDirectories: true)
    guard fileManager.fileExists(atPath: target.path) else { continue }
    var mutableURL = target
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    do {
      try mutableURL.setResourceValues(resourceValues)
    } catch {
      NSLog("[Pera] exclude-from-backup failed for \\(target.lastPathComponent): \\(error.localizedDescription)")
    }
  }
}
// @pera end exclude-data-from-backup

`;

/**
 * Injects the exclusion function + its call into AppDelegate.swift contents.
 * Pure (string → string) and idempotent so it can be unit-checked or run from a
 * one-off script without a full prebuild. Throws if either anchor is missing,
 * so a silently no-op'd change can't slip through (the Swift template changing
 * out from under us must fail loudly).
 *
 * @param {string} contents AppDelegate.swift source
 * @returns {string} transformed source
 */
function injectBackupExclusion(contents) {
  if (contents.includes(CALL)) {
    return contents; // Already injected (e.g. prebuild without --clean).
  }

  const withFunction = contents.replace(
    /(@main\s*\n\s*class AppDelegate)/,
    `${FUNCTION}$1`
  );
  if (withFunction === contents) {
    throw new Error(
      'withExcludeDataFromBackup: could not find the `@main class AppDelegate` anchor'
    );
  }

  const withCall = withFunction.replace(
    /(didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\? = nil\n\s*\) -> Bool \{\n)/,
    `$1    ${CALL}\n`
  );
  if (withCall === withFunction) {
    throw new Error(
      'withExcludeDataFromBackup: could not find the didFinishLaunchingWithOptions anchor'
    );
  }

  return withCall;
}

// Exclude-all backup rule resources. The native app excludes every domain
// from both cloud backup and device-to-device transfer. Confirm the exact
// domains against the native pera-android res/xml files.
const DATA_EXTRACTION_RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="file" path="." />
        <exclude domain="database" path="." />
        <exclude domain="sharedpref" path="." />
        <exclude domain="external" path="." />
    </cloud-backup>
    <device-transfer>
        <exclude domain="file" path="." />
        <exclude domain="database" path="." />
        <exclude domain="sharedpref" path="." />
        <exclude domain="external" path="." />
    </device-transfer>
</data-extraction-rules>
`;

const FULL_BACKUP_CONTENT_XML = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
</full-backup-content>
`;

/**
 * Point the <application> node at the exclude-all backup rule resources and
 * keep allowBackup=false. Pure (mutates + returns the manifest); throws if the
 * <application> anchor is missing so a template change fails loudly.
 *
 * @param {{ manifest: { application?: Array<{ $: Record<string,string> }> } }} androidManifest
 * @returns {typeof androidManifest}
 */
function setAndroidBackupAttributes(androidManifest) {
  const application = androidManifest?.manifest?.application?.[0];
  if (!application || !application.$) {
    throw new Error('withExcludeDataFromBackup: no <application> in AndroidManifest');
  }
  application.$['android:allowBackup'] = 'false';
  application.$['android:dataExtractionRules'] = '@xml/pera_data_extraction_rules';
  application.$['android:fullBackupContent'] = '@xml/pera_backup_rules';
  return androidManifest;
}

/** Write the two res/xml backup-rule files into the generated Android project. */
const withAndroidBackupRuleFiles = (config) =>
  withDangerousMod(config, [
    'android',
    (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'pera_data_extraction_rules.xml'),
        DATA_EXTRACTION_RULES_XML,
      );
      fs.writeFileSync(
        path.join(xmlDir, 'pera_backup_rules.xml'),
        FULL_BACKUP_CONTENT_XML,
      );
      return config;
    },
  ]);

const withExcludeDataFromBackup = (config) => {
  config = withAppDelegateSwiftMod(config, injectBackupExclusion);
  config = withAndroidManifest(config, (config) => {
    setAndroidBackupAttributes(config.modResults);
    return config;
  });
  config = withAndroidBackupRuleFiles(config);
  return config;
};

module.exports = withExcludeDataFromBackup;
module.exports.injectBackupExclusion = injectBackupExclusion;
module.exports.setAndroidBackupAttributes = setAndroidBackupAttributes;
