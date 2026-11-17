# frozen_string_literal: true
require 'minitest/autorun'
require 'tmpdir'
require 'yaml'

module SharedValues
  XCODEBUILD_ARCHIVE = :archive
end
module UI
  def self.user_error!(message); raise message; end
  def self.message(_); end
  def self.important(_); end
end

# Evaluate the actual lanes against recorded actions. No Fastlane gems, signing,
# networking, build tools, or tester notifications are involved.
class LaneHost
  attr_reader :actions, :lane_context
  def initialize(archive)
    @actions = []
    @lanes = {}
    @lane_context = { SharedValues::XCODEBUILD_ARCHIVE => archive }
  end
  def platform(name); @platform = name; yield; end
  def default_platform(_); end
  def before_all; end
  def desc(_); end
  def lane(name, &block); @lanes[[@platform, name]] = block; end
  alias private_lane lane
  def invoke(name, options = {})
    @platform = :ios
    @lanes.fetch([:ios, name]).call(options)
  end
  def method_missing(name, *args)
    if name == :build_ios
      @actions << [name, args.first]
    elsif @lanes.key?([@platform, name])
      @lanes.fetch([@platform, name]).call(*args)
    else
      @actions << [name, args.first]
      return '1:1:ios:aabb' if name == :get_info_plist_value
      './build/ios/firebase.ipa' if name == :gym
    end
  end
end

class IOSFirebaseLaneTest < Minitest::Test
  ROOT = File.expand_path('../..', __dir__)
  def setup
    @original_env = ENV.to_h
    @work = Dir.mktmpdir
    @host = LaneHost.new(@work)
    path = File.join(ROOT, 'apps/mobile/fastlane/Fastfile')
    @host.instance_eval(File.read(path, encoding: 'UTF-8'), path)
    @host.define_singleton_method(:get_crashlytics_upload_symbols_path) { '/test/upload-symbols' }
    @host.define_singleton_method(:get_xcworkspace_path) { '/test/ios/Pera.xcworkspace' }
    ENV['IOS_FIREBASE_PROVISIONING_PROFILE_NAME'] = 'Firebase App'
    ENV['IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_NAME'] = 'Firebase AutoFill'
    ENV['FIREBASE_IOS_SERVICE_CREDENTIALS_FILE'] = File.join(@work, 'credentials.json')
    File.write(ENV['FIREBASE_IOS_SERVICE_CREDENTIALS_FILE'], '{"client_email":"ci@example.iam","project_id":"pera-test"}')
    ENV['RELEASE_NOTES'] = "Features:\n- Real changelog"
    ENV['FIREBASE_TESTER_GROUPS'] = 'qa-team'
    ENV.delete('FIREBASE_APP_ID_IOS')
  end
  def teardown
    ENV.replace(@original_env)
    FileUtils.remove_entry(@work)
  end
  def test_staging_reexports_archive_without_rebuilding_and_preserves_notes
    @host.invoke(:distribute_firebase, scheme: 'Pera7Staging')
    export = @host.actions.find { |name, _| name == :gym }.last
    assert_equal '/test/ios/Pera.xcworkspace', export[:workspace]
    assert_equal 'Pera7Staging', export[:scheme]
    assert_equal true, export[:skip_build_archive]
    assert_equal @work, export[:archive_path]
    assert_equal 'ad-hoc', export[:export_method]
    assert_equal 'Pera7Staging-firebase.ipa', export[:output_name]
    assert_equal({ 'com.algorandllc.perarn.staging' => 'Firebase App',
                   'com.algorandllc.perarn.staging.PasskeyAutofillCredentialProvider' => 'Firebase AutoFill' }, export[:export_options][:provisioningProfiles])
    upload = @host.actions.find { |name, _| name == :firebase_app_distribution }.last
    assert_equal ENV['RELEASE_NOTES'], upload[:release_notes]
    assert_equal 'qa-team', upload[:groups]
    assert_equal './build/ios/firebase.ipa', upload[:ipa_path]
    assert_equal '1:1:ios:aabb', upload[:app]
    assert_equal({ path: './config/GoogleService-Info.plist', key: 'GOOGLE_APP_ID' }, @host.actions.find { |name, _| name == :get_info_plist_value }.last)
  end
  def test_production_uses_its_own_app_and_extension_ids
    ENV['FIREBASE_APP_ID_IOS'] = '1:1:ios:abcd'
    @host.invoke(:distribute_firebase, scheme: 'PeraAlgoWallet')
    export = @host.actions.find { |name, _| name == :gym }.last
    assert_equal ['com.algorandllc.algorand', 'com.algorandllc.algorand.autofill-extension'], export[:export_options][:provisioningProfiles].keys
    assert_equal '1:1:ios:abcd', @host.actions.last.last[:app]
  end
  def test_build_only_does_not_export_or_upload_firebase
    @host.invoke(:deploy_testflight, scheme: 'Pera7Staging', firebase: true, skip_upload: true)
    assert_equal [:build_ios], @host.actions.map(&:first)
  end
  def test_testflight_is_preserved_and_precedes_opted_in_firebase
    @host.invoke(:deploy_testflight, scheme: 'Pera7Staging', firebase: true)
    actions = @host.actions.map(&:first)
    assert_operator actions.index(:upload_to_testflight), :<, actions.index(:firebase_app_distribution)
    assert_equal './build/ios/Pera7Staging.ipa', @host.actions.find { |name, _| name == :upload_to_testflight }.last[:ipa]
  end
  def test_default_testflight_delivery_does_not_touch_firebase
    @host.invoke(:deploy_testflight, scheme: 'Pera7Staging')
    refute_includes @host.actions.map(&:first), :firebase_app_distribution
  end
  def test_missing_profiles_fail_before_export
    ENV.delete('IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_NAME')
    error = assert_raises(RuntimeError) { @host.invoke(:distribute_firebase, scheme: 'Pera7Staging') }
    assert_match(/separate ad-hoc profiles/, error.message)
    assert_empty @host.actions
  end
  def test_invalid_app_id_fails_before_the_build
    ENV['FIREBASE_APP_ID_IOS'] = 'not-an-app-id'
    error = assert_raises(RuntimeError) { @host.invoke(:deploy_testflight, scheme: 'Pera7Staging', firebase: true) }
    assert_match(/GOOGLE_APP_ID/, error.message)
    assert_empty @host.actions
  end
  def test_credentials_that_are_not_a_service_account_key_fail_before_the_build
    File.write(ENV['FIREBASE_IOS_SERVICE_CREDENTIALS_FILE'], '{"type":"something-else"}')
    error = assert_raises(RuntimeError) { @host.invoke(:deploy_testflight, scheme: 'Pera7Staging', firebase: true) }
    assert_match(/service-account key/, error.message)
    assert_empty @host.actions
  end
  def test_missing_tester_groups_fail_before_the_build
    ENV.delete('FIREBASE_TESTER_GROUPS')
    error = assert_raises(RuntimeError) { @host.invoke(:deploy_testflight, scheme: 'Pera7Staging', firebase: true) }
    assert_match(/FIREBASE_TESTER_GROUPS/, error.message)
    assert_empty @host.actions
  end
  def test_escaped_line_breaks_in_the_notes_reach_firebase_as_real_ones
    ENV['RELEASE_NOTES'] = 'Features:\\n- Escaped'
    @host.invoke(:distribute_firebase, scheme: 'Pera7Staging')
    upload = @host.actions.find { |name, _| name == :firebase_app_distribution }.last
    assert_equal "Features:\n- Escaped", upload[:release_notes]
  end
  def test_manifest_opt_in_keeps_existing_staging_delivery_working
    manifest = YAML.safe_load(File.read(File.join(ROOT, 'ci/pipelines.yml')), aliases: true)
    base = manifest.fetch('_ios_secrets')
    firebase = manifest.fetch('_ios_firebase_secrets')
    assert_equal base, firebase - %w[FIREBASE_SERVICE_ACCOUNT_BASE64 IOS_FIREBASE_PROVISIONING_PROFILE_BASE64 IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_BASE64 IOS_FIREBASE_PROVISIONING_PROFILE_NAME IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_NAME]
    job = manifest.fetch('pipelines').fetch('nightly').fetch('jobs').fetch('ios-staging')
    assert_equal base, job.fetch('secrets')
    refute_equal 'true', job.fetch('env')['FIREBASE_IOS_DISTRIBUTION']
    assert_includes job.fetch('needs'), 'changelog'
  end
end
