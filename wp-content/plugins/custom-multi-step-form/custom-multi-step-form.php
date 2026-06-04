<?php
/**
 * Plugin Name: Custom Multi Step Form
 * Description: Configurable multi-step form block for many different use cases.
 * Version: 0.3.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: A.Pēda
 * Text Domain: custom-multi-step-form
 */

if (!defined('ABSPATH')) {
    exit;
}

class Custom_Multi_Step_Form {

    const BLOCK_DESCRIPTION = 'A configurable multi-step form for many different needs.';

    public function __construct() {
        add_action('init', array($this, 'register_block'));
    }

    private function get_asset_version($relative_path) {
        $asset_path = plugin_dir_path(__FILE__) . ltrim($relative_path, '/');

        if (file_exists($asset_path)) {
            return (string) filemtime($asset_path);
        }

        return '0.3.0';
    }

    public function register_block() {
        if (!function_exists('register_block_type')) {
            return;
        }

        wp_register_script(
            'custom-msf-block-editor',
            plugin_dir_url(__FILE__) . 'assets/js/multi-step-form-block.js',
            array('wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n'),
            $this->get_asset_version('assets/js/multi-step-form-block.js'),
            true
        );

        register_block_type('custom-msf/form', array(
            'api_version'     => 2,
            'title'           => __('Multi Step Form', 'custom-multi-step-form'),
            'description'     => __(self::BLOCK_DESCRIPTION, 'custom-multi-step-form'),
            'category'        => 'widgets',
            'icon'            => 'forms',
            'keywords'        => array('multi-step-form', 'multi', 'step', 'form', 'custom'),
            'editor_script'   => 'custom-msf-block-editor',
            'render_callback' => array($this, 'render_block'),
        ));
    }

    public function render_block() {
        return '<div class="custom-multi-step-form"><p class="custom-multi-step-form__hello">Hello World</p></div>';
    }
}

new Custom_Multi_Step_Form();

register_activation_hook(__FILE__, function () {
    set_transient('custom_msf_just_activated', 1, MINUTE_IN_SECONDS * 5);
});

add_action('admin_notices', function () {
    if (!get_transient('custom_msf_just_activated')) {
        return;
    }

    delete_transient('custom_msf_just_activated');

    if (!current_user_can('edit_posts')) {
        return;
    }

    echo '<div class="notice notice-success is-dismissible"><p>';
    echo esc_html__('Custom Multi Step Form is active. In the editor, search for the block "Multi Step Form".', 'custom-multi-step-form');
    echo '</p></div>';
});
