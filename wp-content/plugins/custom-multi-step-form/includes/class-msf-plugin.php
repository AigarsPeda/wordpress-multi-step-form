<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Plugin {

    private static $instance = null;

    /** @var MSF_CPT */
    public $cpt;

    /** @var MSF_Settings */
    public $settings;

    /** @var MSF_Admin */
    public $admin;

    /** @var MSF_Submit */
    public $submit;

    /** @var MSF_Block */
    public $block;

    public static function instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct() {
        $this->cpt      = new MSF_CPT();
        $this->settings = new MSF_Settings();
        $this->admin    = new MSF_Admin();
        $this->submit   = new MSF_Submit();
        $this->block    = new MSF_Block();

        add_action('current_screen', array('MSF_Seeder', 'maybe_seed_sample_form'));
        add_action('admin_notices', array('MSF_Seeder', 'render_empty_forms_notice'));
    }

    public function activate() {
        $this->cpt->register_post_types();
        flush_rewrite_rules();
        MSF_Seeder::create_banquet_quote_form();
    }

    public function get_asset_version($relative_path) {
        $asset_path = MSF_PLUGIN_DIR . ltrim($relative_path, '/');

        if (file_exists($asset_path)) {
            return (string) filemtime($asset_path);
        }

        return MSF_VERSION;
    }
}
