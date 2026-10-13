import type {
    LibraryOptions,
    Plugin,
    PluginOption,
    UserConfig,
    BuildOptions,
} from 'vite'

export interface PackageManifest {
    name?: string
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
}

export type ExternalSpecifier = string | RegExp

export declare const runtimeDependencies: (
    manifest: PackageManifest,
) => string[]

export declare const packageNameOf: (specifier: string) => string

export declare const createExternal: (options: {
    manifest: PackageManifest
    extra?: ExternalSpecifier[]
    bundled?: string[]
}) => (id: string) => boolean

export declare const noInliningGuard: (options: {
    root: string
    manifest: PackageManifest
    bundled?: string[]
}) => Plugin

export type LibraryConfigOptions = {
    root: string
    entry: LibraryOptions['entry']
    fileName?: LibraryOptions['fileName']
    plugins?: PluginOption[]
    external?: ExternalSpecifier[]
    bundled?: string[]
    build?: Omit<BuildOptions, 'lib' | 'rollupOptions' | 'rolldownOptions'>
}

export declare const defineLibraryConfig: (
    options: LibraryConfigOptions,
) => UserConfig
