# PeraWidgets

Bridge from the app to its home-screen widgets. It stores the JSON snapshot and cached NFT images
where the widgets can read them; the schema lives in the app's `widgets` module and is described in
`docs/WIDGETS.md`.

- iOS writes to the App Group named by the app's Info.plist `AppGroupIdentifier`. The extension reads
  the same keys, so `pera.widgets.snapshot` and the `widgets/nft-<key>.jpg` layout must change on both
  sides together.
- iOS image downloads are https only, capped at 10 MB with a 15 s timeout, and downsampled to 600 px
  before being written, because the widget process is killed silently near 30 MB.
- On Android this module also holds the Glance widgets themselves, which read the snapshot from
  SharedPreferences `pera_widgets`. No Android widget renders an image, so `syncImages` downloads
  nothing.
