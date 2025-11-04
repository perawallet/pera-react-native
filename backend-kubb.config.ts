import { defineConfig } from '@kubb/core'
import { pluginMsw } from '@kubb/plugin-msw'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginTs } from '@kubb/plugin-ts'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginZod } from '@kubb/plugin-zod'

export default defineConfig(() => {
    return {
        name: 'backend-api',
        input: {
            path: './specs/backend-openapi.json',
        },
        output: {
            barrelType: 'named',
            clean: true,
            path: './packages/core/src/api/generated/backend',
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
                    importPath: '../../../backend-query-client',
                },
                output: {
                    path: 'hooks',
                    barrelType: 'named',
                },
                infinite: {
                    cursorParam: "next",
                    queryParam: "cursor",
                    initialPageParam: ""
                },
                paramsType: 'object',
                pathParamsType: 'object',
                parser: 'client', //TODO: we should replace this with 'zod' once the backend OpenAPI is cleaned up
            }),
            pluginZod({
                output: {
                    path: 'zod',
                    barrelType: 'named',
                },
                typed: false,
                unknownType: 'unknown',
                inferred: true,
                dateType: false, //TODO: zod doesn't support +1000 style offsets - we need to switch the backend to a supported model
            }),
            pluginMsw({
                output: {
                    path: 'mocks',
                    barrelType: 'named',
                },
                handlers: true,
            }),
        ],
    }
})
