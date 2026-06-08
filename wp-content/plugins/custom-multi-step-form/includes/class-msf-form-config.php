<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Form_Config {

    const META_KEY = '_msf_config';

    const QUESTION_TYPES = array('text', 'textarea', 'number', 'radio', 'checkbox', 'email', 'tel', 'date', 'file', 'consent');

    public static function default_config() {
        return array(
            'schemaVersion' => 3,
            'settings'      => array(
                'ownerEmail'           => '',
                'successMessage'       => 'Paldies! Jūsu pieteikums ir saņemts.',
                'customerEmailSubject' => 'Jūsu pieteikums ir saņemts',
                'customerEmailBody'    => "Sveiki!\n\nPaldies par pieteikumu. Mēs sazināsimies ar Jums drīzumā.",
                'submitLabel'          => 'Nosūtīt',
                'nextLabel'            => 'Tālāk',
                'backLabel'            => 'Atpakaļ',
                'summaryTitle'         => 'Kopsavilkums',
                'showProgressBar'      => true,
                'stepTransitionMs'     => 400,
                'customCss'            => '',
                'pageCss'              => '',
            ),
            'pricing' => array(
                'enabled'            => false,
                'baseAmount'         => 0,
                'perGuestRate'       => 0,
                'perGuestQuestionId' => 'q_guest_count',
                'displayOn'          => 'summary',
                'currency'           => 'EUR',
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

        $display_on = sanitize_key($config['pricing']['displayOn']);
        if (!in_array($display_on, array('summary', 'sticky', 'both', 'none'), true)) {
            $display_on = 'summary';
        }
        $config['pricing']['displayOn'] = $display_on;
        $config['settings']['customCss'] = self::sanitize_custom_css(
            isset($config['settings']['customCss']) ? $config['settings']['customCss'] : ''
        );
        $config['settings']['pageCss'] = self::sanitize_custom_css(
            isset($config['settings']['pageCss']) ? $config['settings']['pageCss'] : ''
        );

        $config['schemaVersion'] = 3;
        $config['steps']         = self::normalize_steps(
            isset($config['steps']) && is_array($config['steps']) ? $config['steps'] : array()
        );
        $config['flowLayout']    = self::normalize_flow_layout(
            isset($config['flowLayout']) ? $config['flowLayout'] : null
        );

        return $config;
    }

    private static function normalize_flow_layout($flow_layout) {
        if (!is_array($flow_layout) || empty($flow_layout['nodes']) || !is_array($flow_layout['nodes'])) {
            return null;
        }

        $nodes = array();

        foreach ($flow_layout['nodes'] as $node) {
            if (!is_array($node) || empty($node['stepId'])) {
                continue;
            }

            $nodes[] = array(
                'stepId' => sanitize_key($node['stepId']),
                'x'      => isset($node['x']) ? floatval($node['x']) : 0,
                'y'      => isset($node['y']) ? floatval($node['y']) : 0,
            );
        }

        if (empty($nodes)) {
            return null;
        }

        return array(
            'version' => 1,
            'nodes'   => $nodes,
        );
    }

    private static function normalize_steps($steps) {
        $normalized = array();
        $index      = 0;

        foreach ($steps as $step) {
            if (!is_array($step)) {
                continue;
            }

            $step_type = isset($step['type']) ? sanitize_key($step['type']) : 'question';

            if ($step_type === 'summary') {
                $normalized[] = array(
                    'id'          => !empty($step['id']) ? sanitize_key($step['id']) : 'step_summary',
                    'type'        => 'summary',
                    'title'       => sanitize_text_field(isset($step['title']) ? $step['title'] : ''),
                    'description' => sanitize_text_field(isset($step['description']) ? $step['description'] : ''),
                    'visibility'  => self::normalize_visibility(isset($step['visibility']) ? $step['visibility'] : array()),
                    'questions'   => array(),
                );
                $index++;
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

            $normalized[] = array(
                'id'          => !empty($step['id']) ? sanitize_key($step['id']) : 'step_' . ($index + 1),
                'type'        => 'question',
                'title'       => sanitize_text_field(isset($step['title']) ? $step['title'] : ''),
                'description' => sanitize_text_field(isset($step['description']) ? $step['description'] : ''),
                'visibility'  => self::normalize_visibility(isset($step['visibility']) ? $step['visibility'] : array()),
                'interval'    => array(
                    'afterPreviousMs' => absint(isset($step['interval']['afterPreviousMs']) ? $step['interval']['afterPreviousMs'] : 0),
                ),
                'questions'   => array($question),
            );

            $index++;

            if ($index >= 30) {
                break;
            }
        }

        return $normalized;
    }

    private static function normalize_visibility($visibility) {
        $visibility = is_array($visibility) ? $visibility : array();
        $mode       = isset($visibility['mode']) ? sanitize_key($visibility['mode']) : 'always';

        if (!in_array($mode, array('always', 'conditional', 'never'), true)) {
            $mode = 'always';
        }

        $normalized = array(
            'mode'       => $mode,
            'logic'      => isset($visibility['logic']) && $visibility['logic'] === 'or' ? 'or' : 'and',
            'conditions' => array(),
            'groups'     => array(),
        );

        if (!empty($visibility['conditions']) && is_array($visibility['conditions'])) {
            foreach ($visibility['conditions'] as $condition) {
                if (!is_array($condition) || empty($condition['questionId'])) {
                    continue;
                }

                $normalized['conditions'][] = array(
                    'questionId' => sanitize_key($condition['questionId']),
                    'operator'   => sanitize_key(isset($condition['operator']) ? $condition['operator'] : 'equals'),
                    'value'      => is_array($condition['value']) ? $condition['value'] : sanitize_text_field((string) $condition['value']),
                );
            }
        }

        if (!empty($visibility['groups']) && is_array($visibility['groups'])) {
            foreach ($visibility['groups'] as $group) {
                if (!is_array($group)) {
                    continue;
                }

                $normalized_group = self::normalize_rule_group($group);

                if (!empty($normalized_group['conditions']) || !empty($normalized_group['groups'])) {
                    $normalized['groups'][] = $normalized_group;
                }
            }
        }

        return $normalized;
    }

    private static function normalize_rule_group($group) {
        $normalized = array(
            'logic'      => isset($group['logic']) && $group['logic'] === 'or' ? 'or' : 'and',
            'conditions' => array(),
            'groups'     => array(),
        );

        if (!empty($group['conditions']) && is_array($group['conditions'])) {
            foreach ($group['conditions'] as $condition) {
                if (!is_array($condition) || empty($condition['questionId'])) {
                    continue;
                }

                $normalized['conditions'][] = array(
                    'questionId' => sanitize_key($condition['questionId']),
                    'operator'   => sanitize_key(isset($condition['operator']) ? $condition['operator'] : 'equals'),
                    'value'      => is_array($condition['value']) ? $condition['value'] : sanitize_text_field((string) $condition['value']),
                );
            }
        }

        if (!empty($group['groups']) && is_array($group['groups'])) {
            foreach ($group['groups'] as $nested_group) {
                if (!is_array($nested_group)) {
                    continue;
                }

                $normalized_nested = self::normalize_rule_group($nested_group);

                if (!empty($normalized_nested['conditions']) || !empty($normalized_nested['groups'])) {
                    $normalized['groups'][] = $normalized_nested;
                }
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
            'id'          => $id,
            'type'        => $type,
            'label'       => $label,
            'description' => sanitize_text_field(isset($question['description']) ? $question['description'] : ''),
            'required'    => !empty($question['required']),
            'options'     => array(),
        );

        if (in_array($type, array('radio', 'checkbox'), true)) {
            $normalized['options'] = self::normalize_options(
                isset($question['options']) ? $question['options'] : array()
            );
        }

        if ($type === 'number') {
            $validation = array(
                'min' => isset($question['validation']['min']) && $question['validation']['min'] !== '' ? floatval($question['validation']['min']) : null,
                'max' => isset($question['validation']['max']) && $question['validation']['max'] !== '' ? floatval($question['validation']['max']) : null,
            );

            $normalized['validation'] = $validation;

            $placeholder = isset($question['placeholder']) ? sanitize_text_field($question['placeholder']) : '';

            if ($placeholder !== '') {
                $normalized['placeholder'] = $placeholder;
            }

            $examples = self::normalize_number_examples(
                isset($question['numberExamples']) ? $question['numberExamples'] : array(),
                $validation
            );

            if (!empty($examples)) {
                $normalized['numberExamples'] = $examples;
            }
        }

        if ($type === 'file') {
            $normalized['validation'] = array(
                'maxSizeMb' => isset($question['validation']['maxSizeMb']) ? floatval($question['validation']['maxSizeMb']) : 5,
            );
        }

        if ($type === 'consent') {
            $normalized['consentText']      = sanitize_text_field(isset($question['consentText']) ? $question['consentText'] : $label);
            $normalized['consentLinkUrl']   = esc_url_raw(isset($question['consentLinkUrl']) ? $question['consentLinkUrl'] : '');
            $normalized['consentLinkLabel'] = sanitize_text_field(isset($question['consentLinkLabel']) ? $question['consentLinkLabel'] : '');
        }

        if ($type === 'text') {
            $format = isset($question['format']) ? sanitize_key($question['format']) : '';

            if (in_array($format, array('email', 'phone'), true)) {
                $normalized['format'] = $format;
            }
        }

        return $normalized;
    }

    private static function normalize_number_examples($examples, $validation) {
        $normalized = array();
        $seen       = array();

        if (!is_array($examples)) {
            return $normalized;
        }

        $min = isset($validation['min']) ? floatval($validation['min']) : null;
        $max = isset($validation['max']) ? floatval($validation['max']) : null;

        foreach ($examples as $value) {
            if (!is_numeric($value)) {
                continue;
            }

            $number = floatval($value);
            $key    = (string) $number;

            if (isset($seen[ $key ])) {
                continue;
            }

            if ($min !== null && $number < $min) {
                continue;
            }

            if ($max !== null && $number > $max) {
                continue;
            }

            $seen[ $key ]       = true;
            $normalized[] = $number;
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

            $item = array(
                'value' => $value,
                'label' => $label,
            );

            if (!empty($option['priceEffect']) && is_array($option['priceEffect'])) {
                $effect = array();

                if (isset($option['priceEffect']['add'])) {
                    $effect['add'] = floatval($option['priceEffect']['add']);
                }

                if (!empty($option['priceEffect']['perGuest'])) {
                    $effect['perGuest'] = true;
                }

                if (!empty($effect)) {
                    $item['priceEffect'] = $effect;
                }
            }

            $normalized[] = $item;
        }

        return $normalized;
    }

    public static function get_public($form_id) {
        $config = self::get($form_id);

        if (!$config || empty($config['steps'])) {
            return null;
        }

        $settings = $config['settings'];
        $pricing  = $config['pricing'];

        return array(
            'formId'   => absint($form_id),
            'settings' => array(
                'submitLabel'      => $settings['submitLabel'],
                'nextLabel'        => $settings['nextLabel'],
                'backLabel'        => $settings['backLabel'],
                'summaryTitle'     => $settings['summaryTitle'],
                'showProgressBar'  => !empty($settings['showProgressBar']),
                'stepTransitionMs' => absint($settings['stepTransitionMs']),
            ),
            'pricing' => array(
                'enabled'            => !empty($pricing['enabled']),
                'baseAmount'         => floatval($pricing['baseAmount']),
                'perGuestRate'       => floatval($pricing['perGuestRate']),
                'perGuestQuestionId' => sanitize_key($pricing['perGuestQuestionId']),
                'displayOn'          => sanitize_key($pricing['displayOn']),
                'currency'           => MSF_Pricing::get_currency($pricing),
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

    public static function sanitize_custom_css($css) {
        if (!is_string($css)) {
            return '';
        }

        $css = wp_unslash($css);
        $css = html_entity_decode($css, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $css = wp_strip_all_tags($css);
        $css = preg_replace('/@import\b[^;]+;?/i', '', $css);
        $css = preg_replace('/javascript\s*:/i', '', $css);
        $css = preg_replace('/expression\s*\(/i', '', $css);

        return trim($css);
    }

    /**
     * @return string Style tag HTML or empty string.
     */
    public static function render_custom_css_tag($form_id, $css) {
        $form_id = absint($form_id);
        $css     = self::sanitize_custom_css($css);

        if ($css === '' || !$form_id) {
            return '';
        }

        $css = apply_filters('msf_form_custom_css', $css, $form_id);

        return sprintf(
            '<style id="msf-form-custom-css-%1$s">%2$s</style>',
            esc_attr((string) $form_id),
            $css // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- sanitized CSS for trusted editors
        );
    }

    /**
     * @return string Style tag HTML or empty string.
     */
    public static function render_page_css_tag($form_id, $css) {
        $form_id = absint($form_id);
        $css     = self::sanitize_custom_css($css);

        if ($css === '' || !$form_id) {
            return '';
        }

        $css = apply_filters('msf_form_page_css', $css, $form_id);

        return sprintf(
            '<style id="msf-form-page-css-%1$s">%2$s</style>',
            esc_attr((string) $form_id),
            $css // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- sanitized CSS for trusted editors
        );
    }
}
