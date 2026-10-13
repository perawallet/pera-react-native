import { readFileSync, existsSync, realpathSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, isAbsolute, join, sep } from 'node:path'

const BUILTINS = new Set(builtinModules)

const readManifest = root =>
    JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/**
 * Every package a library build must leave as an import: its declared runtime
 * dependencies and peers. devDependencies are deliberately absent, so a
 * devDependency that `src/` imports gets inlined — and trips the guard below
 * unless it is listed in `bundled`.
 */
export const runtimeDependencies = manifest => [
    ...new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
        ...Object.keys(manifest.optionalDependencies ?? {}),
    ]),
]

/** The package a bare specifier names: `@scope/pkg/sub` → `@scope/pkg`. */
export const packageNameOf = specifier => {
    const parts = specifier.split('/')
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

// Builtins stay imports: Vite's library build stubs them to `{}`, while the
// app's bundler aliases them (`crypto` → react-native-quick-crypto).
const isBuiltin = specifier =>
    specifier.startsWith('node:') || BUILTINS.has(packageNameOf(specifier))

/**
 * Rollup `external` predicate for a package: dependencies and peers
 * (including deep subpaths such as `@noble/hashes/sha2.js`), node builtins,
 * and any `extra` specifiers or patterns.
 */
export const createExternal = ({ manifest, extra = [], bundled = [] }) => {
    const bundledSet = new Set(bundled)
    const names = new Set(
        runtimeDependencies(manifest).filter(name => !bundledSet.has(name)),
    )
    const extraStrings = new Set(extra.filter(e => typeof e === 'string'))
    const extraPatterns = extra.filter(e => e instanceof RegExp)

    return id => {
        if (
            extraStrings.has(id) ||
            extraPatterns.some(pattern => pattern.test(id))
        )
            return true
        if (isBuiltin(id)) return true
        // Resolved ids are absolute paths, never a package name.
        if (id.startsWith('.') || id.startsWith('/') || id.startsWith('\0'))
            return false
        return names.has(packageNameOf(id))
    }
}

const manifestNameCache = new Map()

/** Name of the package a resolved module file belongs to. */
const owningPackage = file => {
    const nodeModulesAt = file.lastIndexOf(`${sep}node_modules${sep}`)
    if (nodeModulesAt !== -1) {
        return packageNameOf(
            file
                .slice(nodeModulesAt + `${sep}node_modules${sep}`.length)
                .split(sep)
                .join('/'),
        )
    }
    let dir = dirname(file)
    while (dir !== dirname(dir)) {
        if (manifestNameCache.has(dir)) return manifestNameCache.get(dir)
        const manifestPath = join(dir, 'package.json')
        if (existsSync(manifestPath)) {
            const name =
                JSON.parse(readFileSync(manifestPath, 'utf8')).name ??
                manifestPath
            manifestNameCache.set(dir, name)
            return name
        }
        dir = dirname(dir)
    }
    return file
}

/**
 * Fails the build when a module from outside the package's own directory ends
 * up inside `dist`. Inlining a workspace sibling duplicates its module state
 * (zustand stores, algosdk classes behind `instanceof`) for every consumer
 * that resolves `dist`, and inlining an undeclared package hides a missing
 * dependency that breaks the moment it is externalized.
 */
export const noInliningGuard = ({ root, manifest, bundled = [] }) => {
    const packageRoot = realpathSync(root) + sep
    const allowed = new Set(bundled)

    return {
        name: 'pera-no-inlined-dependencies',
        generateBundle(_options, bundle) {
            const offenders = new Map()
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== 'chunk') continue
                for (const id of chunk.moduleIds) {
                    if (!isAbsolute(id)) continue
                    let file
                    try {
                        file = realpathSync(id.split('?')[0])
                    } catch {
                        continue
                    }
                    if (
                        file.startsWith(packageRoot) &&
                        !file.includes(`${sep}node_modules${sep}`)
                    )
                        continue
                    const name = owningPackage(file)
                    if (allowed.has(name)) continue
                    offenders.set(name, file)
                }
            }
            if (offenders.size === 0) return
            const list = [...offenders.keys()].sort().join(', ')
            this.error(
                `${manifest.name} would inline ${list} into dist. Declare ${offenders.size === 1 ? 'it' : 'them'} in dependencies or peerDependencies, or list deliberate inlining in \`bundled\`.`,
            )
        },
    }
}

/**
 * Vite library-mode config shared by every workspace package. Externals come
 * from the package's own package.json, so they cannot drift from it.
 *
 * `root` is the package directory. `external` adds specifiers the manifest
 * cannot express (a bundler alias such as `react-native`). `bundled` names
 * packages that are inlined on purpose; each one needs a comment at the call
 * site saying why.
 */
export const defineLibraryConfig = ({
    root,
    entry,
    fileName,
    plugins = [],
    external = [],
    bundled = [],
    build = {},
}) => {
    const manifest = readManifest(root)

    return {
        plugins: [...plugins, noInliningGuard({ root, manifest, bundled })],
        build: {
            ...build,
            lib: {
                entry,
                formats: ['es'],
                ...(fileName === undefined ? {} : { fileName }),
            },
            rolldownOptions: {
                external: createExternal({
                    manifest,
                    extra: external,
                    bundled,
                }),
            },
        },
    }
}
