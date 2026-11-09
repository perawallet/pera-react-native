# Locale bundles

Read `docs/I18N_TRANSLATION_GUIDE.md` before adding or revising a bundle. `pera/locale-key-parity` (in `pnpm lint`) enforces **bidirectional** key parity against `en.json`, so an extra key fails as loudly as a missing one, so never add CLDR plural categories (`_many`) that `en.json` doesn't use. The guide also records the register per locale (French is formal `vous` on purpose), the two terms that deliberately differ between bundles, and the per-language traps, such as Turkish suffixes never attaching to a `{{placeholder}}`.
