<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Submission rate limiting via WordPress transients (no external services).
 */
class MSF_Rate_Limit {

    const OPTION_KEY = 'msf_rate_limit';

    const DEFAULTS = array(
        'enabled'        => true,
        'maxSubmissions' => 5,
        'windowMinutes'  => 60,
    );

    public static function get_settings() {
        $stored = get_option(self::OPTION_KEY, array());

        if (!is_array($stored)) {
            $stored = array();
        }

        $settings = wp_parse_args($stored, self::DEFAULTS);
        $settings['enabled']        = !empty($settings['enabled']);
        $settings['maxSubmissions'] = max(0, (int) $settings['maxSubmissions']);
        $settings['windowMinutes']  = max(1, (int) $settings['windowMinutes']);

        return apply_filters('msf_rate_limit_settings', $settings);
    }

    public static function sanitize_settings($value) {
        if (!is_array($value)) {
            return self::DEFAULTS;
        }

        return array(
            'enabled'        => !empty($value['enabled']),
            'maxSubmissions' => max(0, (int) ($value['maxSubmissions'] ?? self::DEFAULTS['maxSubmissions'])),
            'windowMinutes'  => max(1, (int) ($value['windowMinutes'] ?? self::DEFAULTS['windowMinutes'])),
        );
    }

    public static function is_enabled() {
        $settings = self::get_settings();

        return $settings['enabled'] && $settings['maxSubmissions'] > 0;
    }

    /**
     * @param int $form_id
     * @return true|WP_Error True when allowed; WP_Error when rate limited.
     */
    public static function check($form_id) {
        if (!self::is_enabled()) {
            return true;
        }

        if (self::should_bypass()) {
            return true;
        }

        $form_id  = absint($form_id);
        $settings = self::get_settings();
        $key      = self::get_transient_key($form_id);
        $count    = (int) get_transient($key);

        if ($count >= $settings['maxSubmissions']) {
            $errors = MSF_I18n::submit_error_strings();

            return new WP_Error(
                'rate_limited',
                $errors['rate_limited'],
                array('status' => 429)
            );
        }

        return true;
    }

    /**
     * Record a successful submission against the rate limit counter.
     *
     * @param int $form_id
     */
    public static function record($form_id) {
        if (!self::is_enabled() || self::should_bypass()) {
            return;
        }

        $form_id  = absint($form_id);
        $settings = self::get_settings();
        $key      = self::get_transient_key($form_id);
        $ttl      = $settings['windowMinutes'] * MINUTE_IN_SECONDS;
        $count    = (int) get_transient($key);

        set_transient($key, $count + 1, $ttl);
    }

    private static function should_bypass() {
        /**
         * Allow trusted users to bypass rate limiting (e.g. admins testing forms).
         *
         * @param bool $bypass Default false.
         */
        $bypass = apply_filters('msf_rate_limit_bypass', false);

        if ($bypass) {
            return true;
        }

        return is_user_logged_in() && current_user_can('manage_options');
    }

    private static function get_transient_key($form_id) {
        $ip = self::get_client_ip();

        return 'msf_rl_' . md5($ip . '|' . absint($form_id));
    }

    private static function get_client_ip() {
        $ip = '';

        if (!empty($_SERVER['REMOTE_ADDR'])) {
            $ip = sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']));
        }

        /**
         * Filter the client IP used for rate limiting.
         *
         * Use when the site is behind a reverse proxy or CDN and REMOTE_ADDR
         * is not the visitor IP (e.g. set from CF-Connecting-IP).
         *
         * @param string $ip
         */
        return apply_filters('msf_rate_limit_ip', $ip);
    }
}
