Pod::Spec.new do |s|
  s.name           = 'LegacyMigration'
  s.version        = '1.0.0'
  s.summary        = 'Legacy Pera v6 migration data reader'
  s.description    = 'Reads legacy Pera v6 user data from Core Data, Keychain, SQLite, and UserDefaults for migration to Pera v7'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.libraries = 'sqlite3'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
