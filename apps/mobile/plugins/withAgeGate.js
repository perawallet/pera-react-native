// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withDangerousMod, withAppBuildGradle, withMainApplication, withXcodeProject } = require('expo/config-plugins');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// ─── Android constants ────────────────────────────────────────────────────────

const AGE_GATE_ANDROID_SRC_DIR = 'age-gate-android';
const ANDROID_JAVA_SRC_REL = 'app/src/main/java';
const AGE_GATE_PACKAGE_PATH = 'com/algorand/perarn/peraagegate';

// NOTE: Pin the version against the dependency policy before shipping to prod.
// 0.0.3 is the earliest published version; check play:age-signals on Maven Central.
const AGE_SIGNALS_DEPENDENCY = 'com.google.android.play:age-signals:0.0.3';
const AGE_SIGNALS_LINE = `    implementation('${AGE_SIGNALS_DEPENDENCY}')`;

const AGE_GATE_PACKAGE_FQN = 'com.algorand.perarn.peraagegate.PeraAgeGatePackage';
const AGE_GATE_PACKAGE_CLASS = 'PeraAgeGatePackage';
const AGE_GATE_IMPORT_LINE = `import ${AGE_GATE_PACKAGE_FQN}`;
const AGE_GATE_REGISTER_CALL = `add(${AGE_GATE_PACKAGE_CLASS}())`;

// ─── iOS constants ────────────────────────────────────────────────────────────

const AGE_GATE_IOS_SRC_DIR = 'age-gate-ios';
const AGE_GATE_IOS_GROUP_NAME = 'AgeGate';
const AGE_GATE_IOS_FILES = ['PeraAgeGate.swift', 'PeraAgeGate.m'];

// ─── Shared helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line no-console
const warn = (msg) => console.warn(`[withAgeGate] ${msg}`);

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

const withAgeGateAndroidSources = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const sourceDirAbs = path.join(projectRoot, AGE_GATE_ANDROID_SRC_DIR);
      const javaSrcAbs = path.join(platformProjectRoot, ANDROID_JAVA_SRC_REL);
      const destAbs = path.join(javaSrcAbs, AGE_GATE_PACKAGE_PATH);

      if (!fs.existsSync(sourceDirAbs)) {
        warn(`canonical source dir "${AGE_GATE_ANDROID_SRC_DIR}/" not found — skipping copy.`);
        return config;
      }

      // Wipe the dest package dir so stale files don't linger across prebuilds.
      fs.rmSync(destAbs, { recursive: true, force: true });
      copyKotlinTree(sourceDirAbs, javaSrcAbs);

      return config;
    },
  ]);

// ─── Android: add age-signals gradle dependency ───────────────────────────────

const patchAppBuildGradle = (contents) => {
  // Guard against double-insertion.
  if (contents.includes('com.google.android.play:age-signals')) {
    return contents;
  }
  const patched = contents.replace(
    /^dependencies \{$/m,
    `dependencies {\n${AGE_SIGNALS_LINE}`,
  );
  if (patched === contents) {
    throw new Error(
      '[withAgeGate] could not find `dependencies {` block in app/build.gradle — Expo template may have changed.',
    );
  }
  return patched;
};

const withAgeGateAndroidDependency = (config) =>
  withAppBuildGradle(config, (config) => {
    config.modResults.contents = patchAppBuildGradle(config.modResults.contents);
    return config;
  });

// ─── Android: register PeraAgeGatePackage in MainApplication.kt ───────────────

const IMPORT_RE = /^import .+$/gm;
const APPLY_BLOCK_RE = /(PackageList\(this\)\.packages\.apply\s*\{)([^}]*)(\})/;
const BARE_PACKAGES_RE = /PackageList\(this\)\.packages(?!\.apply)/;

const addAgeGateImport = (contents) => {
  if (contents.includes(AGE_GATE_IMPORT_LINE)) return contents;
  let end = -1;
  for (const match of contents.matchAll(IMPORT_RE)) {
    end = match.index + match[0].length;
  }
  if (end === -1) {
    throw new Error('[withAgeGate] no `import` statements found — cannot place PeraAgeGatePackage import.');
  }
  return `${contents.slice(0, end)}\n${AGE_GATE_IMPORT_LINE}${contents.slice(end)}`;
};

const addAgeGateRegistration = (contents) => {
  if (contents.includes(AGE_GATE_REGISTER_CALL)) return contents;
  if (APPLY_BLOCK_RE.test(contents)) {
    return contents.replace(APPLY_BLOCK_RE, (_full, opener, body, closer) => {
      const trimmed = body.replace(/\s*$/, '');
      return `${opener}${trimmed}\n          ${AGE_GATE_REGISTER_CALL}\n        ${closer}`;
    });
  }
  if (BARE_PACKAGES_RE.test(contents)) {
    return contents.replace(
      BARE_PACKAGES_RE,
      `PackageList(this).packages.apply {\n          ${AGE_GATE_REGISTER_CALL}\n        }`,
    );
  }
  throw new Error('[withAgeGate] could not find `PackageList(this).packages` — Expo template may have changed.');
};

const patchMainApplication = (contents) => addAgeGateRegistration(addAgeGateImport(contents));

const withAgeGateAndroidMainApplication = (config) =>
  withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error(`[withAgeGate] unsupported MainApplication language "${config.modResults.language}" — expected "kt".`);
    }
    config.modResults.contents = patchMainApplication(config.modResults.contents);
    return config;
  });

// ─── iOS: copy source files ───────────────────────────────────────────────────

const withAgeGateIosSources = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName: targetName } = config.modRequest;
      const sourceDirAbs = path.join(projectRoot, AGE_GATE_IOS_SRC_DIR);
      const destDirAbs = path.join(platformProjectRoot, targetName, AGE_GATE_IOS_GROUP_NAME);

      if (!fs.existsSync(sourceDirAbs)) {
        warn(`canonical source dir "${AGE_GATE_IOS_SRC_DIR}/" not found — skipping copy.`);
        return config;
      }

      fs.mkdirSync(destDirAbs, { recursive: true });
      for (const filename of AGE_GATE_IOS_FILES) {
        const src = path.join(sourceDirAbs, filename);
        if (!fs.existsSync(src)) {
          warn(`source file "${filename}" not found in "${AGE_GATE_IOS_SRC_DIR}/" — skipping.`);
          continue;
        }
        fs.copyFileSync(src, path.join(destDirAbs, filename));
      }

      return config;
    },
  ]);

// ─── iOS: register files in Xcode project ────────────────────────────────────
//
// Uses the same pbxproj manipulation pattern as withMigrationModule.js:
// 1. Find (or create) a named PBXGroup under the app target's root group.
// 2. Call proj.addSourceFile(projectRelPath, { target }, groupKey) for each
//    file not already present (proj.hasFile guards against double-adding).
//
// Manual fallback (if prebuild reveals this needs adjustment):
//   In Xcode, drag `ios/<AppName>/AgeGate/PeraAgeGate.swift` and
//   `PeraAgeGate.m` into the project navigator under the app target group,
//   ensure "Copy items if needed" is unchecked and "Add to targets: <AppName>"
//   is checked. Xcode will add both files to the Sources build phase.

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

const ensureAgeGateGroup = (proj, parentKey) => {
  const existing = findChildGroupKey(proj, parentKey, AGE_GATE_IOS_GROUP_NAME);
  if (existing) return existing;
  const { uuid } = proj.addPbxGroup([], AGE_GATE_IOS_GROUP_NAME, null);
  getPbxGroups(proj)[parentKey].children.push({
    value: uuid,
    comment: AGE_GATE_IOS_GROUP_NAME,
  });
  return uuid;
};

const withAgeGateIosXcodeProject = (config) =>
  withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const { platformProjectRoot, projectName: targetName } = config.modRequest;
    const projectRelDir = `${targetName}/${AGE_GATE_IOS_GROUP_NAME}`;
    const dirAbs = path.join(platformProjectRoot, projectRelDir);

    if (!fs.existsSync(dirAbs)) {
      warn(`${projectRelDir} does not exist on disk; pbxproj registration skipped.`);
      return config;
    }

    const target = proj.pbxTargetByName(targetName);
    if (!target) {
      throw new Error(`[withAgeGate] target "${targetName}" not found in Xcode project`);
    }

    const parentKey = findGroupKeyMatching(
      proj,
      (g) => g.name === targetName || g.path === targetName,
    );
    if (!parentKey) {
      throw new Error(`[withAgeGate] parent group "${targetName}" not found in pbxproj`);
    }

    const ageGateGroupKey = ensureAgeGateGroup(proj, parentKey);
    // Groups created without a path should have path deleted to avoid Xcode confusion.
    delete getPbxGroups(proj)[ageGateGroupKey].path;

    for (const filename of AGE_GATE_IOS_FILES) {
      const projectRelPath = `${projectRelDir}/${filename}`;
      if (proj.hasFile(projectRelPath)) continue;
      proj.addSourceFile(projectRelPath, { target: target.uuid }, ageGateGroupKey);
    }

    return config;
  });

// ─── Compose ──────────────────────────────────────────────────────────────────

const withAgeGate = (config) =>
  withAgeGateIosXcodeProject(
    withAgeGateIosSources(
      withAgeGateAndroidMainApplication(
        withAgeGateAndroidDependency(
          withAgeGateAndroidSources(config)
        )
      )
    )
  );

module.exports = withAgeGate;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
module.exports.patchMainApplication = patchMainApplication;
