Pod::Spec.new do |s|
  s.name           = 'PeraBiometricBinding'
  s.version        = '1.0.0'
  s.summary        = 'Biometric enrollment binding'
  s.description    = "Detects changes to the device's enrolled biometric set so a re-enrolled biometric cannot inherit an existing opt-in"
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
