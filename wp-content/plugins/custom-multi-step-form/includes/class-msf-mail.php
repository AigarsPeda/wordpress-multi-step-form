<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Sends mail via WordPress wp_mail() so plugins like WP Mail SMTP control delivery (Gmail, etc.).
 */
class MSF_Mail {

    public static function uses_wp_mail_smtp() {
        return defined('WPMS_PLUGIN_VER')
            || function_exists('wp_mail_smtp')
            || class_exists('WPMailSMTP\Core');
    }

    public static function get_delivery_description() {
        if (self::uses_wp_mail_smtp()) {
            return __('Submission emails are sent through WP Mail SMTP using your configured mailer (e.g. Gmail). From name, From email, and SMTP settings come from that plugin.', 'custom-multi-step-form');
        }

        return __('Submission emails use WordPress wp_mail() (server default). Install and configure WP Mail SMTP for Gmail or other SMTP.', 'custom-multi-step-form');
    }

    /**
     * @param string       $to
     * @param string       $subject
     * @param string       $body
     * @param array|string $extra_headers
     * @return bool
     */
    public static function send($to, $subject, $body, $extra_headers = array()) {
        $to = sanitize_email($to);

        if (!is_email($to)) {
            return false;
        }

        $headers = array('Content-Type: text/plain; charset=UTF-8');

        if (is_string($extra_headers)) {
            $extra_headers = array($extra_headers);
        }

        foreach ($extra_headers as $header) {
            $header = trim((string) $header);

            if ($header !== '') {
                $headers[] = $header;
            }
        }

        /**
         * Filter email headers before wp_mail (WP Mail SMTP still handles transport).
         *
         * @param array  $headers
         * @param string $to
         * @param string $subject
         */
        $headers = apply_filters('msf_mail_headers', $headers, $to, $subject);

        return wp_mail($to, $subject, $body, $headers);
    }
}
