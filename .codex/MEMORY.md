# Project Environment

- Expo SDK 57 (`expo` 57.0.8), React Native 0.86, and Expo Router.
- iOS, Android, and web are configured; native directories are generated and ignored.
- Bun lockfile and Bun-based tests are present, although `package.json` currently declares Yarn 1 in `packageManager`.
- Metro uses the default port, 8081.
- EAS project: `exponathan/clarity` (`654f9e52-e892-44e4-a4b8-9aa700fef15b`).
- App variants are selected with `APP_VARIANT`; development, preview, and production use separate identifiers, names, schemes, and icons.
- Preview builds use internal distribution, the `preview` EAS environment, and the `preview` update channel.
- GitHub Actions runs Expo code review from trusted base-revision configuration. EAS PR previews require the maintainer-controlled `preview-approved` label and bundle in the secrets-free custom `pr-preview` environment (supported by the Production plan), which contains only `APP_VARIANT=preview`.
- Tests are custom Bun scripts; there is no configured unit-test framework, E2E framework, lint script, or typecheck script.
