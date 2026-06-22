Pod::Spec.new do |s|
  s.name           = 'PeraPasskeyAutofillSecrets'
  s.version        = '1.0.0'
  s.summary        = 'Writes the keystore master key to the passkey-autofill store as raw bytes.'
  s.description    = 'Native module that persists the master key to the shared App Group store without ever materializing a non-zeroable hex string in the JS heap.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
