<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Validation {

    public static function is_valid_email($value) {
        $value = sanitize_email($value);

        return $value !== '' && is_email($value);
    }

    public static function is_valid_phone($value) {
        $value = trim((string) $value);

        if ($value === '') {
            return false;
        }

        if (!preg_match('/^[0-9+\s().\-]+$/', $value)) {
            return false;
        }

        $digits = preg_replace('/\D+/', '', $value);

        return strlen($digits) >= 8 && strlen($digits) <= 15;
    }

    public static function sanitize_phone($value) {
        return sanitize_text_field(trim((string) $value));
    }

    public static function get_contact_format($question) {
        $type = isset($question['type']) ? $question['type'] : '';

        if ($type === 'email') {
            return 'email';
        }

        if ($type === 'tel') {
            return 'phone';
        }

        if (!empty($question['format']) && in_array($question['format'], array('email', 'phone'), true)) {
            return $question['format'];
        }

        if ($type !== 'text') {
            return null;
        }

        $id    = strtolower((string) ($question['id'] ?? ''));
        $label = strtolower((string) ($question['label'] ?? ''));

        if (
            strpos($id, 'phone') !== false
            || strpos($id, 'tel') !== false
            || strpos($label, 'tālruņ') !== false
            || strpos($label, 'talrun') !== false
            || strpos($label, 'phone') !== false
        ) {
            return 'phone';
        }

        if (
            strpos($id, 'email') !== false
            || strpos($id, 'epast') !== false
            || strpos($label, 'e-past') !== false
            || strpos($label, 'epast') !== false
            || strpos($label, 'email') !== false
        ) {
            return 'email';
        }

        return null;
    }
}
