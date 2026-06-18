Pod::Spec.new do |s|
  s.name           = 'PeraBluetooth'
  s.version        = '1.0.0'
  s.summary        = 'Surfaces the OS turn-on-Bluetooth prompt for Ledger.'
  s.description    = 'Native module that presents the iOS/Android system Bluetooth-enable prompt.'
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
