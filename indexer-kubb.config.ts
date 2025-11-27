import { defineConfig } from '@kubb/core'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginTs } from '@kubb/plugin-ts'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginZod } from '@kubb/plugin-zod'

export default defineConfig(() => {
    return {
        name: 'indexer-api',
        input: {
            path: './specs/indexer-openapi.json',
        },
        output: {
            barrelType: 'named',
            clean: true,
            path: './generated/indexer',
        },
        plugins: [
            pluginOas({
                output: {
                    path: 'schemas',
                    barrelType: false,
                },
            }),
            pluginTs({
                enumType: 'literal',
                output: {
                    path: 'types',
                    barrelType: 'named',
                },
                unknownType: 'unknown',
            }),
            pluginReactQuery({
                client: {
                    importPath: '../../../indexer-query-client',
                },
                output: {
                    path: 'hooks',
                    barrelType: 'named',
                },
                paramsType: 'object',
                pathParamsType: 'object',
                parser: 'zod',
            }),
            pluginZod({
                output: {
                    path: 'zod',
                    barrelType: 'named',
                },
                typed: false,
                unknownType: 'unknown',
                inferred: true,
            }),
        ],
    }
})
