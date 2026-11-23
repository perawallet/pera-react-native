# frozen_string_literal: true
require 'minitest/autorun'

module UI
  def self.user_error!(message); raise message; end
  def self.message(_); end
  def self.important(_); end
end

# The real Android deploy lanes against recorded actions: no Fastlane gems, builds or uploads.
class AndroidIdentityLaneHost
  attr_reader :actions
  def initialize
    @actions = []
    @lanes = {}
  end
  def platform(name); @platform = name; yield; end
  def default_platform(_); end
  def before_all; end
  def desc(_); end
  def lane(name, &block); @lanes[[@platform, name]] = block; end
  alias private_lane lane
  def invoke(name, options = {}); @lanes.fetch([:android, name]).call(options); end
  def method_missing(name, *args); @actions << [name, args]; nil; end
  def respond_to_missing?(*); true; end
end

class AndroidIdentityLaneTest < Minitest::Test
  FASTFILE = File.expand_path('../../apps/mobile/fastlane/Fastfile', __dir__)
  CHECK = ['node', '../scripts/verify-android-identity.mjs', '--from-build'].freeze

  def setup
    @original_env = ENV.to_h
    @host = AndroidIdentityLaneHost.new
    @host.instance_eval(File.read(FASTFILE, encoding: 'UTF-8'), FASTFILE)
    host = @host
    @host.define_singleton_method(:build_android) { |options| host.actions << [:build_android, [options[:artifact_type]]] }
    @host.define_singleton_method(:resolve_build_number) { 4242 }
    ENV.delete('CI_RELEASE_NOTES_SUMMARY')
  end

  def teardown; ENV.replace(@original_env); end

  def names; @host.actions.map(&:first); end

  def test_checks_the_production_aab_before_uploading_it_to_play
    ENV['ANDROID_PACKAGE_NAME'] = 'com.algorand.android'
    @host.invoke(:deploy_internal, flavor: 'production')
    check = @host.actions.index([:sh, CHECK])
    refute_nil check
    assert_equal [:build_android, ['aab']], @host.actions[check - 1]
    assert_operator check, :<, names.index(:upload_to_play_store)
  end

  def test_checks_the_production_apk_before_sending_it_to_firebase
    ENV['ANDROID_PACKAGE_NAME'] = 'com.algorand.android'
    @host.invoke(:deploy_firebase, flavor: 'production')
    check = @host.actions.index([:sh, CHECK])
    refute_nil check
    assert_operator check, :<, names.index(:firebase_app_distribution)
  end

  def test_skips_the_check_for_staging
    ENV['ANDROID_PACKAGE_NAME'] = 'com.algorand.perarn.staging'
    @host.invoke(:deploy_internal, flavor: 'staging')
    @host.invoke(:deploy_firebase, flavor: 'staging')
    refute_includes names, :sh
  end
end
