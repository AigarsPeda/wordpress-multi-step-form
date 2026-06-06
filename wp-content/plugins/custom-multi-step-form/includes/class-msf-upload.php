<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Upload {

    const DEFAULT_MAX_MB = 5;

    public static function get_allowed_mimes() {
        return apply_filters('msf_allowed_upload_mimes', array(
            'jpg|jpeg|jpe' => 'image/jpeg',
            'png'          => 'image/png',
            'gif'          => 'image/gif',
            'webp'         => 'image/webp',
            'pdf'          => 'application/pdf',
            'doc'          => 'application/msword',
            'docx'         => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ));
    }

    public static function get_max_bytes($question = array()) {
        $max_mb = self::DEFAULT_MAX_MB;

        if (!empty($question['validation']['maxSizeMb'])) {
            $max_mb = floatval($question['validation']['maxSizeMb']);
        }

        $max_mb = max(0.1, min(20, $max_mb));

        return (int) ($max_mb * 1024 * 1024);
    }

    /**
     * @param array $file $_FILES item.
     * @param array $question Question config.
     * @return array|WP_Error Upload result with url, file, name keys.
     */
    public static function handle($file, $question = array()) {
        if (empty($file['name']) || !empty($file['error'])) {
            return new WP_Error('upload', __('File upload failed.', 'custom-multi-step-form'));
        }

        if (!empty($file['size']) && $file['size'] > self::get_max_bytes($question)) {
            return new WP_Error('upload_size', __('File is too large.', 'custom-multi-step-form'));
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';

        $overrides = array(
            'test_form' => false,
            'mimes'     => self::get_allowed_mimes(),
        );

        $upload = wp_handle_upload($file, $overrides);

        if (isset($upload['error'])) {
            return new WP_Error('upload', $upload['error']);
        }

        return $upload;
    }
}
