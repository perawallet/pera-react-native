Pod::Spec.new do |s|
  s.name           = 'PeraWidgets'
  s.version        = '1.0.0'
  s.summary        = 'Home-screen widget data bridge'
  s.description    = 'Writes the widget snapshot and cached NFT images into the shared App Group'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit', 'ImageIO', 'UniformTypeIdentifiers', 'Security', 'CryptoKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # WidgetPinning.swift is a symlink into targets/widget, so the app and the extension pin identically.
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  # The module reads and writes the App Group's UserDefaults, which CA92.1 in the app's own manifest excludes.
  s.resource_bundles = { 'PeraWidgetsPrivacy' => ['PrivacyInfo.xcprivacy'] }
end
