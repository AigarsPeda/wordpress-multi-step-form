<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Form_Config {

    const META_KEY = '_msf_config';

    const QUESTION_TYPES = array('text', 'textarea', 'number', 'radio', 'checkbox', 'email');

    public static function default_config() {
        return array(
            'schemaVersion' => 1,
            'settings'      => array(
                'ownerEmail'           => '',
                'successMessage'       => 'Paldies! Jūsu pieteikums ir saņemts.',
                'customerEmailSubject' => 'Jūsu pieteikums ir saņemts',
                'customerEmailBody'    => "Sveiki!\n\nPaldies par pieteikumu. Mēs sazināsimies ar Jums drīzumā.",
                'submitLabel'          => 'Nosūtīt',
                'nextLabel'            => 'Tālāk',
                'backLabel'            => 'Atpakaļ',
                'showProgressBar'      => true,
                'stepTransitionMs'     => 400,
            ),
            'pricing' => array(
                'enabled'    => false,
                'baseAmount' => 0,
                'displayOn'  => 'summary',
            ),
            'steps' => array(),
        );
    }

    public static function get($form_id) {
        $form_id = absint($form_id);

        if (!$form_id || get_post_type($form_id) !== 'msf_form') {
            return null;
        }

        $stored = get_post_meta($form_id, self::META_KEY, true);

        if (!is_array($stored)) {
            $stored = array();
        }

        return self::normalize(array_merge(self::default_config(), $stored));
    }

    public static function save($form_id, $config) {
        $form_id = absint($form_id);

        if (!$form_id || get_post_type($form_id) !== 'msf_form') {
            return false;
        }

        update_post_meta($form_id, self::META_KEY, self::normalize($config));

        return true;
    }

    public static function normalize($config) {
        $defaults = self::default_config();
        $config   = wp_parse_args($config, $defaults);
        $config['settings'] = wp_parse_args(
            isset($config['settings']) && is_array($config['settings']) ? $config['settings'] : array(),
            $defaults['settings']
        );
        $config['pricing'] = wp_parse_args(
            isset($config['pricing']) && is_array($config['pricing']) ? $config['pricing'] : array(),
            $defaults['pricing']
        );
        $config['schemaVersion'] = 1;
        $config['steps']         = self::normalize_steps(
            isset($config['steps']) && is_array($config['steps']) ? $config['steps'] : array()
        );

        return $config;
    }

    private static function normalize_steps($steps) {
        $normalized = array();
        $index      = 0;

        foreach ($steps as $step) {
            if (!is_array($step)) {
                continue;
            }

            $questions = isset($step['questions']) && is_array($step['questions']) ? $step['questions'] : array();

            if (empty($questions) && !empty($step['question']) && is_array($step['question'])) {
                $questions = array($step['question']);
            }

            if (empty($questions)) {
                continue;
            }

            $question = self::normalize_question($questions[0], $index);

            if (!$question) {
                continue;
            }

            $step_id = !empty($step['id']) ? sanitize_key($step['id']) : 'step_' . ($index + 1);

            $normalized[] = array(
                'id'          => $step_id,
                'title'       => sanitize_text_field(isset($step['title']) ? $step['title'] : ''),
                'description' => sanitize_text_field(isset($step['description']) ? $step['description'] : ''),
                'questions'   => array($question),
            );

            $index++;

            if ($index >= 30) {
                break;
            }
        }

        return $normalized;
    }

    private static function normalize_question($question, $index) {
        if (!is_array($question)) {
            return null;
        }

        $type = isset($question['type']) ? sanitize_key($question['type']) : 'text';

        if (!in_array($type, self::QUESTION_TYPES, true)) {
            $type = 'text';
        }

        $label = isset($question['label']) ? sanitize_text_field($question['label']) : '';

        if ($label === '') {
            return null;
        }

        $id = !empty($question['id']) ? sanitize_key($question['id']) : 'q_' . ($index + 1);

        $normalized = array(
            'id'       => $id,
            'type'     => $type,
            'label'    => $label,
            'description' => sanitize_text_field(isset($question['description']) ? $question['description'] : ''),
            'required' => !empty($question['required']),
            'options'  => array(),
        );

        if (in_array($type, array('radio', 'checkbox'), true)) {
            $normalized['options'] = self::normalize_options(
                isset($question['options']) ? $question['options'] : array()
            );
        }

        if ($type === 'number') {
            $normalized['validation'] = array(
                'min' => isset($question['validation']['min']) ? floatval($question['validation']['min']) : null,
                'max' => isset($question['validation']['max']) ? floatval($question['validation']['max']) : null,
            );
        }

        return $normalized;
    }

    private static function normalize_options($options) {
        $normalized = array();

        if (!is_array($options)) {
            return $normalized;
        }

        foreach ($options as $option) {
            if (!is_array($option)) {
                continue;
            }

            $value = isset($option['value']) ? sanitize_key($option['value']) : '';
            $label = isset($option['label']) ? sanitize_text_field($option['label']) : '';

            if ($value === '' || $label === '') {
                continue;
            }

            $normalized[] = array(
                'value' => $value,
                'label' => $label,
            );
        }

        return $normalized;
    }

    /** Config safe for front end (no owner email). */
    public static function get_public($form_id) {
        $config = self::get($form_id);

        if (!$config || empty($config['steps'])) {
            return null;
        }

        $settings = $config['settings'];

        return array(
            'formId'  => absint($form_id),
            'settings' => array(
                'submitLabel'     => $settings['submitLabel'],
                'nextLabel'       => $settings['nextLabel'],
                'backLabel'       => $settings['backLabel'],
                'showProgressBar' => !empty($settings['showProgressBar']),
                'stepTransitionMs'=> absint($settings['stepTransitionMs']),
            ),
            'pricing' => array(
                'enabled' => !empty($config['pricing']['enabled']),
            ),
            'steps' => $config['steps'],
        );
    }

    public static function get_owner_email($form_id) {
        $config = self::get($form_id);
        $email  = '';

        if ($config && !empty($config['settings']['ownerEmail'])) {
            $email = sanitize_email($config['settings']['ownerEmail']);
        }

        if ($email && is_email($email)) {
            return $email;
        }

        $default = get_option('msf_default_owner_email', '');

        return is_email($default) ? $default : '';
    }

    public static function get_published_forms() {
        return get_posts(array(
            'post_type'      => 'msf_form',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC',
        ));
    }
}
