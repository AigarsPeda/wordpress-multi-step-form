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
        new MSF_Admin_Actions();
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

    public function register_flatpickr_assets() {
        if (wp_script_is('msf-flatpickr', 'registered')) {
            return;
        }

        wp_register_style(
            'msf-flatpickr',
            MSF_PLUGIN_URL . 'assets/vendor/flatpickr/flatpickr.min.css',
            array(),
            $this->get_asset_version('assets/vendor/flatpickr/flatpickr.min.css')
        );

        wp_register_style(
            'msf-flatpickr-theme',
            MSF_PLUGIN_URL . 'assets/css/flatpickr-msf.css',
            array('msf-flatpickr'),
            $this->get_asset_version('assets/css/flatpickr-msf.css')
        );

        wp_register_script(
            'msf-flatpickr',
            MSF_PLUGIN_URL . 'assets/vendor/flatpickr/flatpickr.min.js',
            array(),
            $this->get_asset_version('assets/vendor/flatpickr/flatpickr.min.js'),
            true
        );

        wp_register_script(
            'msf-flatpickr-lv',
            MSF_PLUGIN_URL . 'assets/vendor/flatpickr/lv.js',
            array('msf-flatpickr'),
            $this->get_asset_version('assets/vendor/flatpickr/lv.js'),
            true
        );
    }

    public function enqueue_flatpickr_assets() {
        $this->register_flatpickr_assets();
        wp_enqueue_style('msf-flatpickr');
        wp_enqueue_style('msf-flatpickr-theme');
        wp_enqueue_script('msf-flatpickr-lv');
    }
}
