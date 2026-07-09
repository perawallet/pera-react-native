Pod::Spec.new do |s|
  s.name           = 'PeraAgeGate'
  s.version        = '1.0.0'
  s.summary        = 'Platform age-range gate'
  s.description    = "Surfaces Apple's DeclaredAgeRange system prompt (iOS 26+) for the age gate"
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
