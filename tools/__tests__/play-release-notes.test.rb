# frozen_string_literal: true
require 'minitest/autorun'

module UI
  def self.user_error!(message); raise message; end
  def self.message(_); end
  def self.important(_); end
end

# The real deploy_internal lane against recorded actions: no Fastlane gems, builds or uploads.
class AndroidLaneHost
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
  def method_missing(name, *args); @actions << [name, args.first]; nil; end
  def respond_to_missing?(*); true; end
end

class PlayReleaseNotesTest < Minitest::Test
  FASTFILE = File.expand_path('../../apps/mobile/fastlane/Fastfile', __dir__)

  def setup
    @original_env = ENV.to_h
    @host = AndroidLaneHost.new
    @host.instance_eval(File.read(FASTFILE, encoding: 'UTF-8'), FASTFILE)
    @host.define_singleton_method(:build_android) { |*| nil }
    @host.define_singleton_method(:resolve_build_number) { 4242 }
  end

  def teardown; ENV.replace(@original_env); end

  def play_upload
    @host.invoke(:deploy_internal, flavor: 'staging')
    @host.actions.find { |name, _| name == :upload_to_play_store }.last
  end

  def test_sends_the_summary_as_this_builds_en_us_changelog_capped_at_500
    ENV['CI_RELEASE_NOTES_SUMMARY'] = "- Swap is faster.\n- #{'x' * 600}"
    ENV['RELEASE_NOTES'] = 'the long changelog'
    upload = play_upload
    refute upload[:skip_upload_changelogs]
    text = File.read(File.join(upload[:metadata_path], 'en-US', 'changelogs', '4242.txt'))
    assert text.start_with?("- Swap is faster.\n")
    assert_equal 500, text.length
  end

  def test_sends_no_changelog_without_a_summary
    ENV.delete('CI_RELEASE_NOTES_SUMMARY')
    ENV['RELEASE_NOTES'] = 'the long changelog'
    upload = play_upload
    assert upload[:skip_upload_changelogs]
    refute upload.key?(:metadata_path)
  end
end
