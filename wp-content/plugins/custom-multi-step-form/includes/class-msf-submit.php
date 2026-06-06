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
        $errors = MSF_I18n::submit_error_strings();
        $nonce  = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '';

        if (!wp_verify_nonce($nonce, 'msf_submit')) {
            wp_send_json_error(
                array('message' => $errors['session_expired']),
                403
            );
        }

        if (!empty($_POST['msf_hp'])) {
            wp_send_json_error(array('message' => $errors['invalid_submit']), 400);
        }

        $form_id = isset($_POST['formId']) ? absint($_POST['formId']) : 0;

        if (!$form_id || get_post_status($form_id) !== 'publish' || get_post_type($form_id) !== 'msf_form') {
            wp_send_json_error(array('message' => $errors['form_not_found']), 404);
        }

        $config = MSF_Form_Config::get($form_id);

        if (!$config || empty($config['steps'])) {
            wp_send_json_error(array('message' => $errors['not_configured']), 400);
        }

        $rate_check = MSF_Rate_Limit::check($form_id);

        if (is_wp_error($rate_check)) {
            wp_send_json_error(
                array('message' => $rate_check->get_error_message()),
                429
            );
        }

        $raw_answers = isset($_POST['answers']) ? json_decode(wp_unslash($_POST['answers']), true) : array();

        if (!is_array($raw_answers)) {
            $raw_answers = array();
        }

        $validated = $this->validate_answers($config, $raw_answers);

        if (is_wp_error($validated)) {
            wp_send_json_error(array('message' => $validated->get_error_message()), 400);
        }

        $pricing_result = MSF_Pricing::calculate($config, $raw_answers);
        $entry_id       = $this->save_entry($form_id, $validated, $config, $pricing_result);

        if (!$entry_id) {
            wp_send_json_error(array('message' => $errors['save_failed']), 500);
        }

        MSF_Rate_Limit::record($form_id);

        $owner_email = MSF_Form_Config::get_owner_email($form_id);
        $customer_email = $this->find_email_answer($config, $raw_answers);

        if ($owner_email) {
            $this->send_owner_email($owner_email, $form_id, $validated, $config, $customer_email, $pricing_result);
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
        $errors        = MSF_I18n::submit_error_strings();
        $formatted     = array();
        $visible_steps = MSF_Logic::get_visible_steps($config['steps'], $raw_answers);

        foreach ($visible_steps as $step) {
            if (!empty($step['type']) && $step['type'] === 'summary') {
                continue;
            }

            if (empty($step['questions'][0])) {
                continue;
            }

            $question = $step['questions'][0];
            $qid      = $question['id'];
            $value    = $this->resolve_answer_value($question, $qid, $raw_answers);

            if (is_wp_error($value)) {
                return $value;
            }

            if (!empty($question['required']) && $this->is_empty_answer($question, $value)) {
                return new WP_Error('required', sprintf($errors['required_field'], $question['label']));
            }

            if ($this->is_empty_answer($question, $value)) {
                continue;
            }

            switch ($question['type']) {
                case 'email':
                    $value = sanitize_email($value);
                    if (!MSF_Validation::is_valid_email($value)) {
                        return new WP_Error('email', $errors['invalid_email']);
                    }
                    break;
                case 'tel':
                    $value = MSF_Validation::sanitize_phone($value);
                    if (!MSF_Validation::is_valid_phone($value)) {
                        return new WP_Error('phone', $errors['invalid_phone']);
                    }
                    break;
                case 'number':
                    $value = floatval($value);
                    break;
                case 'text':
                    $value = sanitize_text_field($value);
                    $contact_format = MSF_Validation::get_contact_format($question);
                    if ($contact_format === 'email' && !MSF_Validation::is_valid_email($value)) {
                        return new WP_Error('email', $errors['invalid_email']);
                    }
                    if ($contact_format === 'phone') {
                        $value = MSF_Validation::sanitize_phone($value);
                        if (!MSF_Validation::is_valid_phone($value)) {
                            return new WP_Error('phone', $errors['invalid_phone']);
                        }
                    }
                    break;
                case 'textarea':
                    $value = sanitize_textarea_field($value);
                    break;
                case 'radio':
                    $value = sanitize_key($value);
                    if (!$this->option_exists($question, $value)) {
                        return new WP_Error('invalid', $errors['invalid_answer']);
                    }
                    break;
                case 'checkbox':
                    if (!is_array($value)) {
                        $value = array($value);
                    }
                    $value = array_map('sanitize_key', $value);
                    foreach ($value as $selected) {
                        if (!$this->option_exists($question, $selected)) {
                            return new WP_Error('invalid', $errors['invalid_answer']);
                        }
                    }
                    break;
                case 'date':
                    $value = sanitize_text_field($value);
                    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                        return new WP_Error('date', $errors['invalid_date']);
                    }
                    break;
                case 'file':
                    if (!is_array($value) || empty($value['url'])) {
                        return new WP_Error('file', $errors['invalid_file']);
                    }
                    break;
                case 'consent':
                    $value = $value === '1' || $value === 1 || $value === true;
                    if (!$value) {
                        return new WP_Error('consent', $errors['consent_required']);
                    }
                    $value = '1';
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

    private function resolve_answer_value($question, $qid, $raw_answers) {
        if ($question['type'] === 'file') {
            $file_key = 'msf_file_' . $qid;

            if (empty($_FILES[$file_key]['name'])) {
                return null;
            }

            $upload = MSF_Upload::handle($_FILES[$file_key], $question);

            if (is_wp_error($upload)) {
                return $upload;
            }

            return array(
                'url'  => esc_url_raw($upload['url']),
                'file' => isset($upload['file']) ? $upload['file'] : '',
                'name' => sanitize_file_name(wp_basename($upload['file'])),
            );
        }

        return isset($raw_answers[$qid]) ? $raw_answers[$qid] : null;
    }

    private function is_empty_answer($question, $value) {
        if (is_wp_error($value)) {
            return true;
        }

        if ($question['type'] === 'consent') {
            return !($value === '1' || $value === 1 || $value === true);
        }

        if ($question['type'] === 'file') {
            return !is_array($value) || empty($value['url']);
        }

        return $value === null || $value === '' || (is_array($value) && empty($value));
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

        if ($question['type'] === 'file' && is_array($value)) {
            if (!empty($value['url'])) {
                return !empty($value['name']) ? $value['name'] . ' (' . $value['url'] . ')' : $value['url'];
            }
        }

        if ($question['type'] === 'consent') {
            return __('Piekrīts', 'custom-multi-step-form');
        }

        if ($question['type'] === 'date' && is_string($value)) {
            $timestamp = strtotime($value);

            if ($timestamp) {
                return wp_date('d/m/Y', $timestamp);
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

    private function save_entry($form_id, $answers, $config, $pricing_result) {
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
        update_post_meta($entry_id, '_msf_entry_pricing', $pricing_result);
        update_post_meta($entry_id, '_msf_entry_page_url', isset($_POST['pageUrl']) ? esc_url_raw(wp_unslash($_POST['pageUrl'])) : '');

        return $entry_id;
    }

    private function send_owner_email($to, $form_id, $answers, $config, $reply_to = '', $pricing_result = array()) {
        $subject = sprintf(
            '[%s] %s',
            wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES),
            get_the_title($form_id)
        );

        $lines = array(__('New form submission:', 'custom-multi-step-form'), '');

        foreach ($answers as $row) {
            $lines[] = $row['label'] . ': ' . $row['display'];
        }

        if (!empty($config['pricing']['enabled']) && !empty($pricing_result)) {
            $lines[] = '';
            $lines[] = MSF_Pricing::format_result_for_email($pricing_result);
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
