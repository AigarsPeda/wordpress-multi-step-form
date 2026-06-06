<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Block {

    const BLOCK_DESCRIPTION = 'A configurable multi-step form for many different needs.';

    private static $runtime_localized = false;

    public function __construct() {
        add_action('init', array($this, 'register_block'));
        add_action('enqueue_block_editor_assets', array($this, 'enqueue_block_editor_assets'));
        add_action('wp_enqueue_scripts', array($this, 'register_front_assets'));
    }

    public function enqueue_block_editor_assets() {
        wp_enqueue_style(
            'msf-form-runtime',
            MSF_PLUGIN_URL . 'assets/css/form-runtime.css',
            array(),
            msf_plugin()->get_asset_version('assets/css/form-runtime.css')
        );

        wp_enqueue_script(
            'msf-form-runtime',
            MSF_PLUGIN_URL . 'assets/js/form-runtime.js',
            array(),
            msf_plugin()->get_asset_version('assets/js/form-runtime.js'),
            true
        );

        if (!wp_script_is('custom-msf-block-editor', 'registered')) {
            return;
        }

        $forms        = array();
        $form_configs = array();

        foreach (MSF_Form_Config::get_published_forms() as $form_post) {
            $forms[] = array(
                'id'    => $form_post->ID,
                'title' => $form_post->post_title,
            );

            $public = MSF_Form_Config::get_public($form_post->ID);

            if ($public) {
                $form_configs[ $form_post->ID ] = $public;
            }
        }

        wp_localize_script(
            'custom-msf-block-editor',
            'msfBlockEditor',
            array(
                'forms'       => $forms,
                'formConfigs' => $form_configs,
                'i18n'        => array(
                    'selectForm'    => __('Select form', 'custom-multi-step-form'),
                    'noForms'       => __('No published forms yet. Create one under Multi Step Forms.', 'custom-multi-step-form'),
                    'showTitle'     => __('Show form title', 'custom-multi-step-form'),
                    'formRequired'  => __('Choose a form below:', 'custom-multi-step-form'),
                    'selected'      => __('Selected form:', 'custom-multi-step-form'),
                    'openSettings'  => __('Tip: open Settings (gear icon, top right) for more options.', 'custom-multi-step-form'),
                    'livePreview'   => __('Live preview', 'custom-multi-step-form'),
                    'previewNote'   => __('Preview only — submissions are disabled in the editor.', 'custom-multi-step-form'),
                ),
                'previewI18n' => MSF_I18n::runtime_strings(),
            )
        );
    }

    public function register_front_assets() {
        wp_register_style(
            'msf-form-runtime',
            MSF_PLUGIN_URL . 'assets/css/form-runtime.css',
            array(),
            msf_plugin()->get_asset_version('assets/css/form-runtime.css')
        );

        wp_register_script(
            'msf-form-runtime',
            MSF_PLUGIN_URL . 'assets/js/form-runtime.js',
            array(),
            msf_plugin()->get_asset_version('assets/js/form-runtime.js'),
            true
        );
    }

    public function register_block() {
        if (!function_exists('register_block_type')) {
            return;
        }

        if (!wp_script_is('msf-form-runtime', 'registered')) {
            wp_register_style(
                'msf-form-runtime',
                MSF_PLUGIN_URL . 'assets/css/form-runtime.css',
                array(),
                msf_plugin()->get_asset_version('assets/css/form-runtime.css')
            );

            wp_register_script(
                'msf-form-runtime',
                MSF_PLUGIN_URL . 'assets/js/form-runtime.js',
                array(),
                msf_plugin()->get_asset_version('assets/js/form-runtime.js'),
                true
            );
        }

        wp_register_script(
            'custom-msf-block-editor',
            MSF_PLUGIN_URL . 'assets/js/multi-step-form-block.js',
            array('wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n', 'msf-form-runtime'),
            msf_plugin()->get_asset_version('assets/js/multi-step-form-block.js'),
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
            'attributes'      => array(
                'formId' => array(
                    'type'    => 'number',
                    'default' => 0,
                ),
                'showTitle' => array(
                    'type'    => 'boolean',
                    'default' => false,
                ),
                'accentColor' => array(
                    'type'    => 'string',
                    'default' => '',
                ),
                'borderRadius' => array(
                    'type'    => 'string',
                    'default' => '',
                ),
                'maxWidth' => array(
                    'type'    => 'string',
                    'default' => '',
                ),
            ),
        ));
    }

    public function render_block($attributes) {
        $form_id = isset($attributes['formId']) ? absint($attributes['formId']) : 0;

        if (!$form_id) {
            if (current_user_can('edit_posts')) {
                return '<p class="msf-form-error">' . esc_html__('Multi Step Form: select a form in the block settings.', 'custom-multi-step-form') . '</p>';
            }

            return '';
        }

        $public_config = MSF_Form_Config::get_public($form_id);

        if (!$public_config) {
            if (current_user_can('edit_posts')) {
                return '<p class="msf-form-error">' . esc_html__('Multi Step Form: form not found or has no steps.', 'custom-multi-step-form') . '</p>';
            }

            return '';
        }

        wp_enqueue_style('msf-form-runtime');
        wp_enqueue_script('msf-form-runtime');

        if (!self::$runtime_localized) {
            wp_localize_script(
                'msf-form-runtime',
                'msfRuntime',
                array(
                    'ajaxUrl' => admin_url('admin-ajax.php'),
                    'nonce'   => wp_create_nonce('msf_submit'),
                    'i18n'    => MSF_I18n::runtime_strings(),
                )
            );
            self::$runtime_localized = true;
        }

        $full_config  = MSF_Form_Config::get($form_id);
        $success_text = $full_config ? $full_config['settings']['successMessage'] : '';
        $show_title   = !empty($attributes['showTitle']);
        $title        = $show_title ? get_the_title($form_id) : '';
        $page_url     = get_permalink() ? get_permalink() : '';
        $submit_nonce = wp_create_nonce('msf_submit');
        $runtime_i18n = MSF_I18n::runtime_strings();

        $inline_styles = self::build_inline_styles($attributes);
        $wrapper_class = apply_filters('msf_form_wrapper_classes', array('msf-form'), $form_id, $attributes);
        $wrapper_class = is_array($wrapper_class) ? implode(' ', array_map('sanitize_html_class', $wrapper_class)) : 'msf-form';

        ob_start();
        include MSF_PLUGIN_DIR . 'templates/form-wrapper.php';
        return ob_get_clean();
    }

    private static function build_inline_styles($attributes) {
        $styles = array();

        if (!empty($attributes['accentColor']) && preg_match('/^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/', $attributes['accentColor'])) {
            $styles[] = '--msf-color-primary: ' . $attributes['accentColor'];
            $styles[] = '--msf-color-price-text: ' . $attributes['accentColor'];
        }

        if (!empty($attributes['borderRadius']) && preg_match('/^\d+(\.\d+)?(px|rem|%)?$/', $attributes['borderRadius'])) {
            $styles[] = '--msf-radius: ' . $attributes['borderRadius'];
        }

        if (!empty($attributes['maxWidth']) && preg_match('/^\d+(\.\d+)?(px|rem|%)?$/', $attributes['maxWidth'])) {
            $styles[] = '--msf-max-width: ' . $attributes['maxWidth'];
        }

        return apply_filters('msf_form_inline_styles', $styles, $attributes);
    }
}
