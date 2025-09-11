import { defineConfig } from "@kubb/core";
import { pluginMsw } from "@kubb/plugin-msw";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { pluginZod } from "@kubb/plugin-zod";

export default defineConfig(() => {
  return {
    name: "api",
    input: {
      path: "./openapi.json",
    },
    output: {
      barrelType: "named",
      clean: true,
      path: "./packages/generated",
    },
    plugins: [
      pluginOas({
        output: {
          path: "schemas",
          barrelType: false,
        },
      }),
      pluginTs({
        enumType: "literal",
        output: {
          path: "types",
          barrelType: false,
        },
        unknownType: "unknown",
      }),
      pluginReactQuery({
        infinite: {
          queryParam: "page",
          cursorParam: "nextPage",
        },
        output: {
          path: "composables",
          barrelType: false,
        },
        paramsType: "object",
        pathParamsType: "object",
        parser: "zod",
      }),
      pluginZod({
        output: {
          path: "zod",
          barrelType: false,
        },
        typed: false,
        unknownType: "unknown",
        inferred: true,
      }),
      pluginMsw({
        output: {
          path: "mocks",
          barrelType: false,
        },
        handlers: true,
      }),
    ],
  };
});
