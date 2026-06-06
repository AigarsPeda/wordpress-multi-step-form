<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Submit {

    public function __construct() {
        add_action('wp_ajax_msf_submit_form', array($this, 'handle'));
        add_action('wp_ajax_nopriv_msf_submit_form', array($this, 'handle'));
    }

    public function handle() {
        $nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '';

        if (!wp_verify_nonce($nonce, 'msf_submit')) {
            wp_send_json_error(
                array('message' => __('Session expired. Please refresh the page and try again.', 'custom-multi-step-form')),
                403
            );
        }

        if (!empty($_POST['msf_hp'])) {
            wp_send_json_error(array('message' => __('Invalid submission.', 'custom-multi-step-form')), 400);
        }

        $form_id = isset($_POST['formId']) ? absint($_POST['formId']) : 0;

        if (!$form_id || get_post_status($form_id) !== 'publish' || get_post_type($form_id) !== 'msf_form') {
            wp_send_json_error(array('message' => __('Form not found.', 'custom-multi-step-form')), 404);
        }

        $config = MSF_Form_Config::get($form_id);

        if (!$config || empty($config['steps'])) {
            wp_send_json_error(array('message' => __('Form is not configured.', 'custom-multi-step-form')), 400);
        }

        $raw_answers = isset($_POST['answers']) ? json_decode(wp_unslash($_POST['answers']), true) : array();

        if (!is_array($raw_answers)) {
            $raw_answers = array();
        }

        $validated = $this->validate_answers($config, $raw_answers);

        if (is_wp_error($validated)) {
            wp_send_json_error(array('message' => $validated->get_error_message()), 400);
        }

        $entry_id = $this->save_entry($form_id, $validated, $config);

        if (!$entry_id) {
            wp_send_json_error(array('message' => __('Could not save submission.', 'custom-multi-step-form')), 500);
        }

        $owner_email = MSF_Form_Config::get_owner_email($form_id);

        $customer_email = $this->find_email_answer($config, $raw_answers);

        if ($owner_email) {
            $this->send_owner_email($owner_email, $form_id, $validated, $config, $customer_email);
        }

        if ($customer_email) {
            $this->send_customer_email($customer_email, $config);
        }

        wp_send_json_success(array(
            'message' => $config['settings']['successMessage'],
            'entryId' => $entry_id,
        ));
    }

    private function validate_answers($config, $raw_answers) {
        $formatted = array();

        foreach ($config['steps'] as $step) {
            if (empty($step['questions'][0])) {
                continue;
            }

            $question = $step['questions'][0];
            $qid      = $question['id'];
            $value    = isset($raw_answers[$qid]) ? $raw_answers[$qid] : null;

            if (!empty($question['required']) && ($value === null || $value === '' || (is_array($value) && empty($value)))) {
                /* translators: %s: question label */
                return new WP_Error('required', sprintf(__('Please answer: %s', 'custom-multi-step-form'), $question['label']));
            }

            if ($value === null || $value === '') {
                continue;
            }

            switch ($question['type']) {
                case 'email':
                    $value = sanitize_email($value);
                    if (!is_email($value)) {
                        return new WP_Error('email', __('Please enter a valid email address.', 'custom-multi-step-form'));
                    }
                    break;
                case 'number':
                    $value = floatval($value);
                    break;
                case 'text':
                    $value = sanitize_text_field($value);
                    break;
                case 'textarea':
                    $value = sanitize_textarea_field($value);
                    break;
                case 'radio':
                    $value = sanitize_key($value);
                    if (!$this->option_exists($question, $value)) {
                        return new WP_Error('invalid', __('Invalid answer selected.', 'custom-multi-step-form'));
                    }
                    break;
                case 'checkbox':
                    if (!is_array($value)) {
                        $value = array($value);
                    }
                    $value = array_map('sanitize_key', $value);
                    foreach ($value as $selected) {
                        if (!$this->option_exists($question, $selected)) {
                            return new WP_Error('invalid', __('Invalid answer selected.', 'custom-multi-step-form'));
                        }
                    }
                    break;
            }

            $formatted[] = array(
                'id'      => $qid,
                'label'   => $question['label'],
                'value'   => $value,
                'display' => $this->format_display($question, $value),
            );
        }

        return $formatted;
    }

    private function option_exists($question, $value) {
        foreach ($question['options'] as $option) {
            if ($option['value'] === $value) {
                return true;
            }
        }

        return false;
    }

    private function format_display($question, $value) {
        if ($question['type'] === 'checkbox' && is_array($value)) {
            $labels = array();

            foreach ($value as $selected) {
                foreach ($question['options'] as $option) {
                    if ($option['value'] === $selected) {
                        $labels[] = $option['label'];
                    }
                }
            }

            return implode(', ', $labels);
        }

        if (in_array($question['type'], array('radio'), true)) {
            foreach ($question['options'] as $option) {
                if ($option['value'] === $value) {
                    return $option['label'];
                }
            }
        }

        if (is_array($value)) {
            return implode(', ', $value);
        }

        return (string) $value;
    }

    private function find_email_answer($config, $raw_answers) {
        foreach ($config['steps'] as $step) {
            if (empty($step['questions'][0])) {
                continue;
            }

            $question = $step['questions'][0];

            if ($question['type'] !== 'email') {
                continue;
            }

            $value = isset($raw_answers[$question['id']]) ? sanitize_email($raw_answers[$question['id']]) : '';

            if (is_email($value)) {
                return $value;
            }
        }

        return '';
    }

    private function save_entry($form_id, $answers, $config) {
        $title = sprintf(
            '%s — %s',
            get_the_title($form_id),
            wp_date('Y-m-d H:i')
        );

        add_filter('map_meta_cap', array($this, 'allow_entry_creation'), 10, 4);

        $entry_id = wp_insert_post(array(
            'post_type'   => 'msf_entry',
            'post_status' => 'publish',
            'post_title'  => $title,
            'post_author' => 1,
        ), true);

        remove_filter('map_meta_cap', array($this, 'allow_entry_creation'), 10);

        if (is_wp_error($entry_id)) {
            return 0;
        }

        update_post_meta($entry_id, '_msf_entry_form_id', $form_id);
        update_post_meta($entry_id, '_msf_entry_answers', $answers);
        update_post_meta($entry_id, '_msf_entry_pricing', array('total' => 0, 'lines' => array()));
        update_post_meta($entry_id, '_msf_entry_page_url', isset($_POST['pageUrl']) ? esc_url_raw(wp_unslash($_POST['pageUrl'])) : '');

        return $entry_id;
    }

    private function send_owner_email($to, $form_id, $answers, $config, $reply_to = '') {
        $subject = sprintf(
            '[%s] %s',
            wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES),
            get_the_title($form_id)
        );

        $lines = array(__('New form submission:', 'custom-multi-step-form'), '');

        foreach ($answers as $row) {
            $lines[] = $row['label'] . ': ' . $row['display'];
        }

        $lines[] = '';
        $lines[] = __('Submitted:', 'custom-multi-step-form') . ' ' . wp_date('Y-m-d H:i');

        $headers = array();

        if ($reply_to && is_email($reply_to)) {
            $headers[] = 'Reply-To: ' . $reply_to;
        }

        MSF_Mail::send($to, $subject, implode("\n", $lines), $headers);
    }

    public function allow_entry_creation($caps, $cap, $user_id, $args) {
        if (!in_array($cap, array('edit_post', 'create_post', 'publish_posts', 'create_posts'), true)) {
            return $caps;
        }

        if (empty($args[0])) {
            return $caps;
        }

        $post_type = is_numeric($args[0]) ? get_post_type((int) $args[0]) : (string) $args[0];

        if ('msf_entry' === $post_type) {
            return array('exist');
        }

        return $caps;
    }

    private function send_customer_email($to, $config) {
        $settings = $config['settings'];
        $subject  = $settings['customerEmailSubject'];
        $body     = $settings['customerEmailBody'];

        MSF_Mail::send($to, $subject, $body);
    }
}
