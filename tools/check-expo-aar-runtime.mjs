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

/**
 * Fails when a prebuilt Expo module AAR that Android autolinking will use calls
 * Expo Modules v2 runtime API missing from the runtime expo-modules-core
 * bundles. Such an AAR compiles and links, then aborts the app on launch when
 * its static initializer runs; nothing pre-merge launches the app.
 *
 * Neither the AAR nor its POM or Gradle module metadata records the runtime it
 * was compiled against, so this reads the bytecode: every class, method and
 * field reference into `io/github/expo/modules/v2/` must resolve in the runtime
 * AAR of the version expo-modules-core pins. Projects matched by
 * `expo.autolinking.android.buildFromSource` are skipped, since they compile
 * against the bundled runtime.
 *
 *   node tools/check-expo-aar-runtime.mjs
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const APP = join(ROOT, 'apps/mobile')
const V2_PACKAGE = 'io/github/expo/modules/v2/'
const RUNTIME_ARTIFACT = 'expo-modules-v2-react'

function fail(message) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
}

function readZip(buffer) {
    let eocd = buffer.length - 22
    while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd--
    if (eocd < 0) throw new Error('not a zip archive')
    const count = buffer.readUInt16LE(eocd + 10)
    let offset = buffer.readUInt32LE(eocd + 16)
    if (count === 0xffff || offset === 0xffffffff) {
        throw new Error('zip64 archives are not supported')
    }
    const entries = new Map()
    for (let i = 0; i < count; i++) {
        const method = buffer.readUInt16LE(offset + 10)
        const size = buffer.readUInt32LE(offset + 20)
        const nameLength = buffer.readUInt16LE(offset + 28)
        const local = buffer.readUInt32LE(offset + 42)
        const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
        offset +=
            46 +
            nameLength +
            buffer.readUInt16LE(offset + 30) +
            buffer.readUInt16LE(offset + 32)
        entries.set(name, () => {
            const start =
                local +
                30 +
                buffer.readUInt16LE(local + 26) +
                buffer.readUInt16LE(local + 28)
            const data = buffer.subarray(start, start + size)
            if (method === 0) return data
            if (method === 8) return inflateRawSync(data)
            throw new Error(`${name}: unsupported zip compression method ${method}`)
        })
    }
    return entries
}

function parseClass(bytes) {
    let p = 8
    const u1 = () => bytes[p++]
    const u2 = () => {
        p += 2
        return bytes.readUInt16BE(p - 2)
    }
    const u4 = () => {
        p += 4
        return bytes.readUInt32BE(p - 4)
    }

    const pool = []
    const poolCount = u2()
    for (let i = 1; i < poolCount; i++) {
        const tag = u1()
        if (tag === 1) {
            const length = u2()
            pool[i] = { tag, text: bytes.toString('utf8', p, p + length) }
            p += length
        } else if (tag === 3 || tag === 4) {
            p += 4
        } else if (tag === 5 || tag === 6) {
            p += 8
            i++
        } else if (tag === 7 || tag === 8 || tag === 16 || tag === 19 || tag === 20) {
            pool[i] = { tag, a: u2() }
        } else if (tag >= 9 && tag <= 12) {
            pool[i] = { tag, a: u2(), b: u2() }
        } else if (tag === 17 || tag === 18) {
            pool[i] = { tag, a: u2(), b: u2() }
        } else if (tag === 15) {
            p += 3
        } else {
            throw new Error(`unknown constant pool tag ${tag}`)
        }
    }
    const utf8 = index => pool[index].text
    const classAt = index => utf8(pool[index].a)

    p += 2
    const name = classAt(u2())
    const superIndex = u2()
    const interfaces = Array.from({ length: u2() }, () => classAt(u2()))
    const members = new Set()
    for (let table = 0; table < 2; table++) {
        for (let count = u2(); count > 0; count--) {
            p += 2
            members.add(`${utf8(u2())}:${utf8(u2())}`)
            for (let attributes = u2(); attributes > 0; attributes--) {
                p += 2
                const length = u4()
                p += length
            }
        }
    }

    const refs = []
    for (const entry of pool) {
        if (entry?.tag === 7) {
            refs.push({ owner: utf8(entry.a) })
        } else if (entry && entry.tag >= 9 && entry.tag <= 11) {
            const nameAndType = pool[entry.b]
            refs.push({
                owner: classAt(entry.a),
                member: `${utf8(nameAndType.a)}:${utf8(nameAndType.b)}`,
            })
        }
    }
    return {
        name,
        superName: superIndex ? classAt(superIndex) : null,
        interfaces,
        members,
        refs,
    }
}

function classesInAar(buffer) {
    const classes = []
    for (const [name, read] of readZip(buffer)) {
        if (name !== 'classes.jar' && !/^libs\/[^/]+\.jar$/.test(name)) continue
        for (const [entry, readEntry] of readZip(read())) {
            if (entry.endsWith('.class')) classes.push(parseClass(readEntry()))
        }
    }
    return classes
}

// A member inherited from a non-v2 ancestor other than Object (an
// Enum, a kotlin or kolibri base class) is taken on trust; checking it needs
// those artifacts too.
function resolves(runtime, owner, member) {
    const queue = [owner]
    const seen = new Set()
    let leftV2 = false
    while (queue.length > 0) {
        const name = queue.shift()
        if (seen.has(name)) continue
        seen.add(name)
        const cls = runtime.get(name)
        if (!cls) {
            if (name === owner) return false
            if (name !== 'java/lang/Object') leftV2 = true
            continue
        }
        if (!member || cls.members.has(member)) return true
        if (cls.superName) queue.push(cls.superName)
        queue.push(...cls.interfaces)
    }
    return leftV2
}

function describe({ owner, member }) {
    if (!member) return owner
    const split = member.indexOf(':')
    return `${owner}.${member.slice(0, split)}${member.slice(split + 1)}`
}

function resolveAutolinking() {
    const expo = createRequire(join(APP, 'package.json')).resolve('expo/package.json')
    const autolinking = createRequire(expo).resolve(
        'expo-modules-autolinking/package.json',
    )
    const result = spawnSync(
        process.execPath,
        [
            join(dirname(autolinking), 'bin/expo-modules-autolinking.js'),
            'resolve',
            '--platform',
            'android',
            '--json',
        ],
        { cwd: APP, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
    if (result.status !== 0) {
        fail(`expo-modules-autolinking resolve failed:\n${result.stderr}`)
    }
    return JSON.parse(result.stdout)
}

async function readRuntimeAar(version) {
    const gradleHome = process.env.GRADLE_USER_HOME ?? join(homedir(), '.gradle')
    const file = `${RUNTIME_ARTIFACT}-${version}.aar`
    const cached = join(
        gradleHome,
        'caches/modules-2/files-2.1/io.github.expo',
        RUNTIME_ARTIFACT,
        version,
    )
    if (existsSync(cached)) {
        for (const hash of readdirSync(cached)) {
            if (existsSync(join(cached, hash, file))) {
                return readFileSync(join(cached, hash, file))
            }
        }
    }
    const url = `https://repo1.maven.org/maven2/io/github/expo/${RUNTIME_ARTIFACT}/${version}/${file}`
    const response = await fetch(url)
    if (!response.ok) fail(`could not download ${url}: HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
}

async function main() {
    const config = resolveAutolinking()
    const projects = config.modules.flatMap(module => module.projects ?? [])

    const coreModule = config.modules.find(
        module => module.packageName === 'expo-modules-core',
    )
    const core = coreModule?.projects?.[0]
    if (!core) fail('autolinking resolved no expo-modules-core project')
    const pin = readFileSync(join(core.sourceDir, 'build.gradle'), 'utf8').match(
        /^def expoModulesV2Version = "([^"]+)"/m,
    )
    if (!pin) {
        fail(
            `could not find expoModulesV2Version in ${join(core.sourceDir, 'build.gradle')}. expo-modules-core changed how it pins the v2 runtime; teach this check the new form rather than dropping it.`,
        )
    }
    const runtimeVersion = pin[1]
    const runtime = new Map(
        classesInAar(await readRuntimeAar(runtimeVersion)).map(cls => [cls.name, cls]),
    )

    const buildFromSource = (config.configuration?.buildFromSource ?? []).map(
        pattern => new RegExp(`^(?:${pattern})$`),
    )
    const prebuilt = projects.filter(project => project.publication)
    if (prebuilt.length === 0) {
        fail(
            'autolinking reported no prebuilt module, so there is nothing to check. Its output format probably changed; refusing to pass vacuously.',
        )
    }

    const broken = []
    let checked = 0
    for (const project of prebuilt) {
        if (buildFromSource.some(pattern => pattern.test(project.name))) continue
        const { repository, groupId, artifactId, version } = project.publication
        const aar = join(
            project.sourceDir,
            '..',
            repository,
            ...groupId.split('.'),
            artifactId,
            version,
            `${artifactId}-${version}.aar`,
        )
        // Gradle falls back to building from source when the repository is absent.
        if (!existsSync(aar)) continue
        checked++

        const classes = classesInAar(readFileSync(aar))
        const own = new Set(classes.map(cls => cls.name))
        const missing = new Set()
        for (const cls of classes) {
            for (const ref of cls.refs) {
                const owner = ref.owner.replace(/^\[+L?|;$/g, '')
                if (!owner.startsWith(V2_PACKAGE) || own.has(owner)) continue
                const member = ref.owner.startsWith('[') ? undefined : ref.member
                if (!resolves(runtime, owner, member)) {
                    missing.add(describe({ owner, member }))
                }
            }
        }
        if (missing.size > 0) broken.push({ project, missing })
    }

    if (broken.length > 0) {
        for (const { project, missing } of broken) {
            console.error(
                `FAIL: ${project.name} ${project.publication.version} ships an AAR compiled against a newer Expo Modules v2 runtime than the ${runtimeVersion} that expo-modules-core ${coreModule.packageVersion} bundles. The app aborts on launch when it loads. Missing from the runtime:`,
            )
            for (const ref of [...missing].sort()) console.error(`  ${ref}`)
        }
        console.error(
            `\nFix: add ${broken.map(({ project }) => `"${project.name}"`).join(', ')} to expo.autolinking.android.buildFromSource in apps/mobile/package.json, or move to versions whose runtimes agree.`,
        )
        process.exit(1)
    }

    console.log(
        `OK: ${checked} prebuilt Expo AARs resolve against Expo Modules v2 runtime ${runtimeVersion}.`,
    )
}

await main()
