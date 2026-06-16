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

// Wires the hand-written PeraBluetooth native module into the prebuild
// project (iOS Xcode target + Android MainApplication). Mirrors withAgeGate.js;
// no external Gradle/Pod dependency is needed — both platforms use framework
// APIs (CoreBluetooth / android.bluetooth).

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withDangerousMod, withMainApplication, withXcodeProject } = require('expo/config-plugins');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// ─── Android constants ────────────────────────────────────────────────────────

const BT_ANDROID_SRC_DIR = 'bluetooth-android';
const ANDROID_JAVA_SRC_REL = 'app/src/main/java';
const BT_PACKAGE_PATH = 'com/algorand/perarn/perabluetooth';

const BT_PACKAGE_FQN = 'com.algorand.perarn.perabluetooth.PeraBluetoothPackage';
const BT_PACKAGE_CLASS = 'PeraBluetoothPackage';
const BT_IMPORT_LINE = `import ${BT_PACKAGE_FQN}`;
const BT_REGISTER_CALL = `add(${BT_PACKAGE_CLASS}())`;

// ─── iOS constants ────────────────────────────────────────────────────────────

const BT_IOS_SRC_DIR = 'bluetooth-ios';
const BT_IOS_GROUP_NAME = 'Bluetooth';
const BT_IOS_FILES = ['PeraBluetooth.swift', 'PeraBluetooth.m'];

// ─── Shared helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line no-console
const warn = (msg) => console.warn(`[withBluetoothEnable] ${msg}`);

// ─── Android: copy source tree ────────────────────────────────────────────────

const isKotlinSource = (filename) => filename.endsWith('.kt');

const copyKotlinTree = (srcDir, destDir) => {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyKotlinTree(src, dest);
    } else if (entry.isFile() && isKotlinSource(entry.name)) {
      fs.copyFileSync(src, dest);
    }
  }
};

const withBluetoothAndroidSources = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const sourceDirAbs = path.join(projectRoot, BT_ANDROID_SRC_DIR);
      const javaSrcAbs = path.join(platformProjectRoot, ANDROID_JAVA_SRC_REL);
      const destAbs = path.join(javaSrcAbs, BT_PACKAGE_PATH);

      if (!fs.existsSync(sourceDirAbs)) {
        warn(`canonical source dir "${BT_ANDROID_SRC_DIR}/" not found — skipping copy.`);
        return config;
      }

      // Wipe the dest package dir so stale files don't linger across prebuilds.
      fs.rmSync(destAbs, { recursive: true, force: true });
      copyKotlinTree(sourceDirAbs, javaSrcAbs);

      return config;
    },
  ]);

// ─── Android: register PeraBluetoothPackage in MainApplication.kt ─────────────

const IMPORT_RE = /^import .+$/gm;
const APPLY_BLOCK_RE = /(PackageList\(this\)\.packages\.apply\s*\{)([^}]*)(\})/;
const BARE_PACKAGES_RE = /PackageList\(this\)\.packages(?!\.apply)/;

const addBluetoothImport = (contents) => {
  if (contents.includes(BT_IMPORT_LINE)) return contents;
  let end = -1;
  for (const match of contents.matchAll(IMPORT_RE)) {
    end = match.index + match[0].length;
  }
  if (end === -1) {
    throw new Error('[withBluetoothEnable] no `import` statements found — cannot place PeraBluetoothPackage import.');
  }
  return `${contents.slice(0, end)}\n${BT_IMPORT_LINE}${contents.slice(end)}`;
};

const addBluetoothRegistration = (contents) => {
  if (contents.includes(BT_REGISTER_CALL)) return contents;
  if (APPLY_BLOCK_RE.test(contents)) {
    return contents.replace(APPLY_BLOCK_RE, (_full, opener, body, closer) => {
      const trimmed = body.replace(/\s*$/, '');
      return `${opener}${trimmed}\n          ${BT_REGISTER_CALL}\n        ${closer}`;
    });
  }
  if (BARE_PACKAGES_RE.test(contents)) {
    return contents.replace(
      BARE_PACKAGES_RE,
      `PackageList(this).packages.apply {\n          ${BT_REGISTER_CALL}\n        }`,
    );
  }
  throw new Error('[withBluetoothEnable] could not find `PackageList(this).packages` — Expo template may have changed.');
};

const patchMainApplication = (contents) =>
  addBluetoothRegistration(addBluetoothImport(contents));

const withBluetoothAndroidMainApplication = (config) =>
  withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error(`[withBluetoothEnable] unsupported MainApplication language "${config.modResults.language}" — expected "kt".`);
    }
    config.modResults.contents = patchMainApplication(config.modResults.contents);
    return config;
  });

// ─── iOS: copy source files ───────────────────────────────────────────────────

const withBluetoothIosSources = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName: targetName } = config.modRequest;
      const sourceDirAbs = path.join(projectRoot, BT_IOS_SRC_DIR);
      const destDirAbs = path.join(platformProjectRoot, targetName, BT_IOS_GROUP_NAME);

      if (!fs.existsSync(sourceDirAbs)) {
        warn(`canonical source dir "${BT_IOS_SRC_DIR}/" not found — skipping copy.`);
        return config;
      }

      fs.mkdirSync(destDirAbs, { recursive: true });
      for (const filename of BT_IOS_FILES) {
        const src = path.join(sourceDirAbs, filename);
        if (!fs.existsSync(src)) {
          warn(`source file "${filename}" not found in "${BT_IOS_SRC_DIR}/" — skipping.`);
          continue;
        }
        fs.copyFileSync(src, path.join(destDirAbs, filename));
      }

      return config;
    },
  ]);

// ─── iOS: register files in Xcode project ────────────────────────────────────
//
// Same pbxproj manipulation as withAgeGate.js / withMigrationModule.js:
// find (or create) a named PBXGroup under the app target's root group and
// add each source file to the target.
//
// Manual fallback (if prebuild reveals this needs adjustment): in Xcode, drag
// `ios/<AppName>/Bluetooth/PeraBluetooth.swift` and `PeraBluetooth.m` into the
// project navigator under the app target group ("Copy items if needed"
// unchecked, "Add to targets: <AppName>" checked).

const getPbxGroups = (proj) => proj.hash.project.objects.PBXGroup;

const findGroupKeyMatching = (proj, predicate) => {
  const groups = getPbxGroups(proj);
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const group = groups[key];
    if (group && typeof group === 'object' && predicate(group, key)) return key;
  }
  return null;
};

const findChildGroupKey = (proj, parentKey, groupName) => {
  const parent = getPbxGroups(proj)[parentKey];
  if (!parent || !Array.isArray(parent.children)) return null;
  for (const child of parent.children) {
    const childGroup = getPbxGroups(proj)[child.value];
    if (childGroup && (childGroup.name === groupName || childGroup.path === groupName)) {
      return child.value;
    }
  }
  return null;
};

const ensureBluetoothGroup = (proj, parentKey) => {
  const existing = findChildGroupKey(proj, parentKey, BT_IOS_GROUP_NAME);
  if (existing) return existing;
  const { uuid } = proj.addPbxGroup([], BT_IOS_GROUP_NAME, null);
  getPbxGroups(proj)[parentKey].children.push({
    value: uuid,
    comment: BT_IOS_GROUP_NAME,
  });
  return uuid;
};

const withBluetoothIosXcodeProject = (config) =>
  withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const { platformProjectRoot, projectName: targetName } = config.modRequest;
    const projectRelDir = `${targetName}/${BT_IOS_GROUP_NAME}`;
    const dirAbs = path.join(platformProjectRoot, projectRelDir);

    if (!fs.existsSync(dirAbs)) {
      warn(`${projectRelDir} does not exist on disk; pbxproj registration skipped.`);
      return config;
    }

    const target = proj.pbxTargetByName(targetName);
    if (!target) {
      throw new Error(`[withBluetoothEnable] target "${targetName}" not found in Xcode project`);
    }

    const parentKey = findGroupKeyMatching(
      proj,
      (g) => g.name === targetName || g.path === targetName,
    );
    if (!parentKey) {
      throw new Error(`[withBluetoothEnable] parent group "${targetName}" not found in pbxproj`);
    }

    const groupKey = ensureBluetoothGroup(proj, parentKey);
    // Groups created without a path should have path deleted to avoid Xcode confusion.
    delete getPbxGroups(proj)[groupKey].path;

    for (const filename of BT_IOS_FILES) {
      const projectRelPath = `${projectRelDir}/${filename}`;
      if (proj.hasFile(projectRelPath)) continue;
      proj.addSourceFile(projectRelPath, { target: target.uuid }, groupKey);
    }

    return config;
  });

// ─── Compose ──────────────────────────────────────────────────────────────────

const withBluetoothEnable = (config) =>
  withBluetoothIosXcodeProject(
    withBluetoothIosSources(
      withBluetoothAndroidMainApplication(
        withBluetoothAndroidSources(config)
      )
    )
  );

module.exports = withBluetoothEnable;
module.exports.patchMainApplication = patchMainApplication;
