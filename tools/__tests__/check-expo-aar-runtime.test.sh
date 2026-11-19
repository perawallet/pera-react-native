#!/usr/bin/env bash
set -uo pipefail

# Drives check-expo-aar-runtime.mjs against a synthetic workspace: a stand-in v2
# runtime at two versions, and prebuilt module AARs compiled against the newer
# one, reproducing the expo-sqlite AAR that called a `register` overload the
# bundled runtime lacked.

for tool in javac jar; do
    command -v "$tool" >/dev/null || { echo "check-expo-aar-runtime: needs a JDK ($tool not found)"; exit 1; }
done

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-expo-aar-runtime.mjs"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/repo/tools" "$WORK/src"
cp "$SCRIPT" "$WORK/repo/tools/"

V2=io/github/expo/modules/v2

# $1 output dir  $2 extra members of SharedObjectRegistry
write_runtime() {
    mkdir -p "$1/$V2/sharedobjects"
    cat > "$1/$V2/sharedobjects/Base.java" <<'EOF'
package io.github.expo.modules.v2.sharedobjects;
public class Base { public void inherited() {} }
EOF
    cat > "$1/$V2/sharedobjects/SharedObjectRegistry.java" <<EOF
package io.github.expo.modules.v2.sharedobjects;
public final class SharedObjectRegistry extends Base {
  public static int register(String name, Class<?> type, Object builder) { return 0; }
  $2
}
EOF
}

# $1 source dir  $2 output aar
package_aar() {
    mkdir -p "$1.out" "$1.aar"
    javac -nowarn -d "$1.out" -cp "$WORK/runtime-027.out" "$1"/expo/modules/fixture/*.java || exit 1
    jar --create --file "$1.aar/classes.jar" -C "$1.out" . || exit 1
    jar --create --file "$2" -C "$1.aar" classes.jar || exit 1
}

write_runtime "$WORK/src/runtime-025" ""
write_runtime "$WORK/src/runtime-027" "public static int register(String name, Class<?> type, Object builder, boolean isNative) { return 0; }"
for version in 025 027; do
    mkdir -p "$WORK/runtime-$version.out" "$WORK/runtime-$version.aar"
    javac -nowarn -d "$WORK/runtime-$version.out" "$WORK/src/runtime-$version/$V2"/sharedobjects/*.java || exit 1
    jar --create --file "$WORK/runtime-$version.aar/classes.jar" -C "$WORK/runtime-$version.out" . || exit 1
done
GRADLE_CACHE="$WORK/gradle/caches/modules-2/files-2.1/io.github.expo/expo-modules-v2-react"
for version in 0.2.5 0.2.7; do
    mkdir -p "$GRADLE_CACHE/$version/0000"
    jar --create --file "$GRADLE_CACHE/$version/0000/expo-modules-v2-react-$version.aar" \
        -C "$WORK/runtime-${version//./}.aar" classes.jar || exit 1
done

# $1 module name  $2 java body of the static initializer
make_module() {
    local dir="$WORK/pkgs/$1"
    local src="$WORK/src/$1/expo/modules/fixture"
    mkdir -p "$dir/android" "$src" "$dir/local-maven-repo/host/exp/exponent/expo.modules.$1/1.0.0"
    cat > "$src/NativeDatabase.java" <<EOF
package expo.modules.fixture;
import io.github.expo.modules.v2.sharedobjects.SharedObjectRegistry;
public final class NativeDatabase {
  static { $2 }
}
EOF
    package_aar "$WORK/src/$1" "$dir/local-maven-repo/host/exp/exponent/expo.modules.$1/1.0.0/expo.modules.$1-1.0.0.aar"
}

make_module sqlite 'SharedObjectRegistry.register("db", NativeDatabase.class, null, true);'
make_module haptics 'SharedObjectRegistry.register("h", NativeDatabase.class, null); new SharedObjectRegistry().inherited();'

mkdir -p "$WORK/pkgs/expo-modules-core/android"
APP="$WORK/repo/apps/mobile"
mkdir -p "$APP/node_modules/expo" "$APP/node_modules/expo-modules-autolinking/bin"
echo '{ "name": "mobile" }' > "$APP/package.json"
echo '{ "name": "expo" }' > "$APP/node_modules/expo/package.json"
echo '{ "name": "expo-modules-autolinking" }' > "$APP/node_modules/expo-modules-autolinking/package.json"
cat > "$APP/node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js" <<'EOF'
process.stdout.write(require('fs').readFileSync(require('path').join(__dirname, '../resolve.json'), 'utf8'))
EOF

project() {
    printf '{ "packageName": "expo-%s", "packageVersion": "1.0.0", "projects": [{ "name": "expo-%s", "sourceDir": "%s/pkgs/%s/android", "publication": { "groupId": "host.exp.exponent", "artifactId": "expo.modules.%s", "repository": "local-maven-repo", "version": "1.0.0" } }] }' \
        "$1" "$1" "$WORK" "$1" "$1"
}

failures=0
PIN_025='def expoModulesV2Version = "0.2.5"'
PIN_027='def expoModulesV2Version = "0.2.7"'

# $1 label  $2 expected exit  $3 expo-modules-core build.gradle line  $4 buildFromSource JSON array
# $5 modules (space-separated)
run_case() {
    local label="$1" want="$2" pin="$3" from_source="$4" modules="$5"
    echo "$pin" > "$WORK/pkgs/expo-modules-core/android/build.gradle"
    local entries
    entries=$(printf '{ "packageName": "expo-modules-core", "packageVersion": "58.0.24", "projects": [{ "name": "expo-modules-core", "sourceDir": "%s/pkgs/expo-modules-core/android" }] }' "$WORK")
    for module in $modules; do entries="$entries, $(project "$module")"; done
    printf '{ "modules": [%s], "configuration": { "buildFromSource": %s } }' "$entries" "$from_source" \
        > "$APP/node_modules/expo-modules-autolinking/resolve.json"

    local output status
    output=$(GRADLE_USER_HOME="$WORK/gradle" node "$WORK/repo/tools/check-expo-aar-runtime.mjs" 2>&1)
    status=$?
    # A crash also exits 1; a real verdict starts with FAIL:.
    if [ "$status" -eq "$want" ] && { [ "$want" -eq 0 ] || [[ "$output" == FAIL:* ]]; }; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: expected exit ${want}, got ${status}"
        echo "        ${output}"
        failures=$((failures + 1))
    fi
}

echo "── runtime mismatch"
run_case "an AAR calling a register overload the bundled runtime lacks fails" 1 "$PIN_025" '[]' "sqlite haptics"
run_case "the same AAR passes once built from source" 0 "$PIN_025" '["expo-splash-screen", "expo-sqlite"]' "sqlite haptics"
run_case "buildFromSource entries match as regexes, like Gradle" 0 "$PIN_025" '["expo-sql.*"]' "sqlite"
run_case "a partial-name entry does not match, like Gradle" 1 "$PIN_025" '["expo-sql"]' "sqlite"
run_case "the AAR passes once the bundled runtime catches up" 0 "$PIN_027" '[]' "sqlite"

echo "── resolution"
run_case "members inherited from a runtime superclass resolve" 0 "$PIN_025" '[]' "haptics"

echo "── no vacuous pass"
run_case "no prebuilt module at all fails" 1 "$PIN_025" '[]' ""
run_case "an unreadable runtime pin fails" 1 'def expoModulesV2Version = libs.versions.v2' '[]' "haptics"

if [ "$failures" -gt 0 ]; then
    echo "check-expo-aar-runtime: ${failures} failure(s)"
    exit 1
fi
echo "check-expo-aar-runtime: all checks passed"
