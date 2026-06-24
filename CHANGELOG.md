# Changelog

## [2.4.0](https://github.com/onecli/node-sdk/compare/v2.3.0...v2.4.0) (2026-06-24)


### Features

* add structured summary to manual-approval requests ([#43](https://github.com/onecli/node-sdk/issues/43)) ([ac95a43](https://github.com/onecli/node-sdk/commit/ac95a439409b1eef4d2a9f6eacaf72610da247ca))

## [2.3.0](https://github.com/onecli/node-sdk/compare/v2.2.1...v2.3.0) (2026-06-14)


### Features

* add listAgents and make ensureAgent idempotent at the agent cap ([#41](https://github.com/onecli/node-sdk/issues/41)) ([74dbae8](https://github.com/onecli/node-sdk/commit/74dbae8df8bcf31ac1bccf6104758a8c3151ec16)), closes [#40](https://github.com/onecli/node-sdk/issues/40)

## [2.2.1](https://github.com/onecli/node-sdk/compare/v2.2.0...v2.2.1) (2026-06-04)


### Bug Fixes

* throw on 4xx in applyContainerConfig instead of failing silently ([#38](https://github.com/onecli/node-sdk/issues/38)) ([564b49f](https://github.com/onecli/node-sdk/commit/564b49f585ae3d4a7c2bf1cd8002d33be4a7f085))

## [2.2.0](https://github.com/onecli/node-sdk/compare/v2.1.0...v2.2.0) (2026-06-02)


### Features

* support credential stubs in container config ([#36](https://github.com/onecli/node-sdk/issues/36)) ([3087ebd](https://github.com/onecli/node-sdk/commit/3087ebd43428505f4d12b7b4c048a7e646f6d21c))

## [2.1.0](https://github.com/onecli/node-sdk/compare/v2.0.0...v2.1.0) (2026-05-24)


### Features

* add parentIdentifier to CreateAgentInput ([#35](https://github.com/onecli/node-sdk/issues/35)) ([02252dd](https://github.com/onecli/node-sdk/commit/02252dd23ae08558f3759568dc88a4541109c277))


### Bug Fixes

* align README with SDK docs ([#33](https://github.com/onecli/node-sdk/issues/33)) ([0a22421](https://github.com/onecli/node-sdk/commit/0a224210b1bad3daa3f6a8520b7dc793acc281b3))

## [2.0.0](https://github.com/onecli/node-sdk/compare/v1.0.0...v2.0.0) (2026-05-19)


### ⚠ BREAKING CHANGES

* migrate API prefix from /api to /v1 and default to api.onecli.sh ([#31](https://github.com/onecli/node-sdk/issues/31))

### Features

* migrate API prefix from /api to /v1 and default to api.onecli.sh ([#31](https://github.com/onecli/node-sdk/issues/31)) ([34184c3](https://github.com/onecli/node-sdk/commit/34184c357b584627bd3cf70c6e23a50a7363453c))

## [1.0.0](https://github.com/onecli/node-sdk/compare/v0.5.0...v1.0.0) (2026-05-11)


### ⚠ BREAKING CHANGES

* add org API key support and rename provisionUser to provisionProject ([#30](https://github.com/onecli/node-sdk/issues/30))

### Features

* add org API key support and rename provisionUser to provisionProject ([#30](https://github.com/onecli/node-sdk/issues/30)) ([ff5825b](https://github.com/onecli/node-sdk/commit/ff5825bb48df91099cb9f0bb014e9fcd6c7690fd))


### Bug Fixes

* isolate CA tests by mocking tmpdir with a unique temp directory ([#28](https://github.com/onecli/node-sdk/issues/28)) ([26fa588](https://github.com/onecli/node-sdk/commit/26fa588882e69edbb546ad81524d32796cf26788))

## [0.5.0](https://github.com/onecli/node-sdk/compare/v0.4.0...v0.5.0) (2026-05-07)


### Features

* add getGatewaySkill method to Node SDK ([#26](https://github.com/onecli/node-sdk/issues/26)) ([efa14af](https://github.com/onecli/node-sdk/commit/efa14afdd36711e1b73d86ba99efda89d16a4964))

## [0.4.0](https://github.com/onecli/node-sdk/compare/v0.3.1...v0.4.0) (2026-05-05)


### Features

* add provisionUser method to SDK ([#23](https://github.com/onecli/node-sdk/issues/23)) ([fe0c09d](https://github.com/onecli/node-sdk/commit/fe0c09d01bea6e5731a031a29b4946a422f796c8))

## [0.3.1](https://github.com/onecli/node-sdk/compare/v0.3.0...v0.3.1) (2026-04-10)


### Bug Fixes

* include agent identifier in approval metadata as externalId ([#19](https://github.com/onecli/node-sdk/issues/19)) ([f3ff938](https://github.com/onecli/node-sdk/commit/f3ff938e73f43a09274c693ebcd5c76e3009e511))

## [0.3.0](https://github.com/onecli/node-sdk/compare/v0.2.0...v0.3.0) (2026-04-09)


### Features

* add manual approval policy action for gateway requests ([#17](https://github.com/onecli/node-sdk/issues/17)) ([3356d0e](https://github.com/onecli/node-sdk/commit/3356d0e22ee688a87f502056944e6d27e7ac517e))

## [0.2.0](https://github.com/onecli/node-sdk/compare/v0.1.6...v0.2.0) (2026-03-23)


### Features

* add ensureAgent method for idempotent agent creation ([#14](https://github.com/onecli/node-sdk/issues/14)) ([eeb8ac4](https://github.com/onecli/node-sdk/commit/eeb8ac4935a33ccbcf525c1a7d1516b709ab85b0))

## [0.1.6](https://github.com/onecli/node-sdk/compare/v0.1.5...v0.1.6) (2026-03-18)


### Bug Fixes

* pass agent parameter to container config endpoint ([#12](https://github.com/onecli/node-sdk/issues/12)) ([5549294](https://github.com/onecli/node-sdk/commit/5549294e0595edb90b03b9b6b7dfaf7d90c0fd7e))

## [0.1.5](https://github.com/onecli/node-sdk/compare/v0.1.4...v0.1.5) (2026-03-17)


### Bug Fixes

* make apiKey optional and add createAgent method ([#10](https://github.com/onecli/node-sdk/issues/10)) ([b8a3137](https://github.com/onecli/node-sdk/commit/b8a3137779a7084f954a4cfedaca1ec15cc85aa7))

## [0.1.4](https://github.com/onecli/node-sdk/compare/v0.1.3...v0.1.4) (2026-03-11)


### Bug Fixes

* package ([#8](https://github.com/onecli/node-sdk/issues/8)) ([949f67c](https://github.com/onecli/node-sdk/commit/949f67c40c3dbeecc05a47e4d19fea51839358fa))

## [0.1.3](https://github.com/onecli/node-sdk/compare/v0.1.2...v0.1.3) (2026-03-11)


### Bug Fixes

* remove standalone ([#6](https://github.com/onecli/node-sdk/issues/6)) ([3a6c077](https://github.com/onecli/node-sdk/commit/3a6c077e348cb027179209780ecaf1f5e633f24b))

## [0.1.2](https://github.com/onecli/node-sdk/compare/v0.1.1...v0.1.2) (2026-03-11)


### Bug Fixes

* tests, pnpm ([#4](https://github.com/onecli/node-sdk/issues/4)) ([3a1ff7f](https://github.com/onecli/node-sdk/commit/3a1ff7f677199606238b53fed76c2e835d2eb815))

## [0.1.1](https://github.com/onecli/node-sdk/compare/v0.1.0...v0.1.1) (2026-03-11)


### Bug Fixes

* node sdk ([#1](https://github.com/onecli/node-sdk/issues/1)) ([f9349fd](https://github.com/onecli/node-sdk/commit/f9349fd527d58b45e153671360d08fcd11d7d10b))
