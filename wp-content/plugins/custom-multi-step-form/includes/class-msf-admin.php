<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Admin {

    public function __construct() {
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post_msf_form', array($this, 'save_form'), 10, 2);
        add_action('admin_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('add_meta_boxes', array($this, 'add_entry_meta_boxes'));
    }

    public function add_meta_boxes() {
        add_meta_box(
            'msf_form_settings',
            __('Form settings', 'custom-multi-step-form'),
            array($this, 'render_settings_meta_box'),
            'msf_form',
            'normal',
            'high'
        );

        add_meta_box(
            'msf_form_steps',
            __('Form steps (one question per step)', 'custom-multi-step-form'),
            array($this, 'render_steps_meta_box'),
            'msf_form',
            'normal',
            'default'
        );
    }

    public function add_entry_meta_boxes() {
        add_meta_box(
            'msf_entry_details',
            __('Submission details', 'custom-multi-step-form'),
            array($this, 'render_entry_meta_box'),
            'msf_entry',
            'normal',
            'high'
        );
    }

    public function enqueue_scripts($hook) {
        global $post;

        if (!in_array($hook, array('post.php', 'post-new.php'), true)) {
            return;
        }

        if (!$post || $post->post_type !== 'msf_form') {
            return;
        }

        wp_enqueue_style(
            'msf-admin',
            MSF_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            msf_plugin()->get_asset_version('assets/css/admin.css')
        );

        wp_enqueue_script(
            'msf-admin-builder',
            MSF_PLUGIN_URL . 'assets/js/admin-builder.js',
            array('jquery'),
            msf_plugin()->get_asset_version('assets/js/admin-builder.js'),
            true
        );

        wp_localize_script('msf-admin-builder', 'msfAdmin', array(
            'questionTypes' => MSF_Form_Config::QUESTION_TYPES,
            'i18n'          => array(
                'step'           => __('Step', 'custom-multi-step-form'),
                'stepTitle'      => __('Step title (optional)', 'custom-multi-step-form'),
                'questionLabel'  => __('Question', 'custom-multi-step-form'),
                'questionType'   => __('Answer type', 'custom-multi-step-form'),
                'required'       => __('Required', 'custom-multi-step-form'),
                'options'        => __('Options (one per line: value|Label|+price|guest)', 'custom-multi-step-form'),
                'addStep'        => __('Add step', 'custom-multi-step-form'),
                'removeStep'     => __('Remove step', 'custom-multi-step-form'),
                'stepType'       => __('Step type', 'custom-multi-step-form'),
                'stepTypeQuestion' => __('Question', 'custom-multi-step-form'),
                'stepTypeSummary'  => __('Summary (review + submit)', 'custom-multi-step-form'),
                'visibilityMode' => __('Step visibility', 'custom-multi-step-form'),
                'visibilityAlways' => __('Always show', 'custom-multi-step-form'),
                'visibilityConditional' => __('Show when condition matches', 'custom-multi-step-form'),
                'visibilityQuestion' => __('When question ID', 'custom-multi-step-form'),
                'visibilityOperator' => __('Operator', 'custom-multi-step-form'),
                'visibilityValue' => __('Value', 'custom-multi-step-form'),
                'types'          => array(
                    'text'     => __('Text', 'custom-multi-step-form'),
                    'textarea' => __('Long text', 'custom-multi-step-form'),
                    'number'   => __('Number', 'custom-multi-step-form'),
                    'radio'    => __('Single choice (radio)', 'custom-multi-step-form'),
                    'checkbox' => __('Multiple choice (checkbox)', 'custom-multi-step-form'),
                    'email'    => __('Email', 'custom-multi-step-form'),
                ),
            ),
        ));
    }

    public function render_settings_meta_box($post) {
        wp_nonce_field('msf_save_form', 'msf_form_nonce');
        $config   = MSF_Form_Config::get($post->ID);
        $settings = $config['settings'];
        ?>
        <table class="form-table msf-form-settings-table">
            <tr>
                <th><label for="msf_owner_email"><?php esc_html_e('Owner email', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="email" class="regular-text" id="msf_owner_email" name="msf_owner_email"
                           value="<?php echo esc_attr($settings['ownerEmail']); ?>"
                           placeholder="<?php esc_attr_e('Uses site default if empty', 'custom-multi-step-form'); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_success_message"><?php esc_html_e('Success message (on page)', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <textarea class="large-text" rows="3" id="msf_success_message" name="msf_success_message"><?php echo esc_textarea($settings['successMessage']); ?></textarea>
                </td>
            </tr>
            <tr>
                <th><label for="msf_customer_subject"><?php esc_html_e('Customer email subject', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="text" class="large-text" id="msf_customer_subject" name="msf_customer_subject"
                           value="<?php echo esc_attr($settings['customerEmailSubject']); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_customer_body"><?php esc_html_e('Customer email body', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <textarea class="large-text" rows="5" id="msf_customer_body" name="msf_customer_body"><?php echo esc_textarea($settings['customerEmailBody']); ?></textarea>
                    <p class="description"><?php esc_html_e('Sent only when the form includes an email question and the visitor fills it in.', 'custom-multi-step-form'); ?></p>
                </td>
            </tr>
            <tr>
                <th><label for="msf_submit_label"><?php esc_html_e('Submit button label', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="text" class="regular-text" id="msf_submit_label" name="msf_submit_label"
                           value="<?php echo esc_attr($settings['submitLabel']); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_step_transition_ms"><?php esc_html_e('Step transition (ms)', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="number" class="small-text" id="msf_step_transition_ms" name="msf_step_transition_ms"
                           min="0" step="50" value="<?php echo esc_attr($settings['stepTransitionMs']); ?>">
                </td>
            </tr>
        </table>

        <?php $pricing = $config['pricing']; ?>
        <h3><?php esc_html_e('Pricing', 'custom-multi-step-form'); ?></h3>
        <table class="form-table msf-form-settings-table">
            <tr>
                <th><?php esc_html_e('Enable pricing', 'custom-multi-step-form'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="msf_pricing_enabled" value="1" <?php checked(!empty($pricing['enabled'])); ?>>
                        <?php esc_html_e('Show running total and include price in owner email', 'custom-multi-step-form'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_base"><?php esc_html_e('Base amount', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="number" class="small-text" id="msf_pricing_base" name="msf_pricing_base"
                           min="0" step="0.01" value="<?php echo esc_attr($pricing['baseAmount']); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_per_guest"><?php esc_html_e('Per-guest rate', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="number" class="small-text" id="msf_pricing_per_guest" name="msf_pricing_per_guest"
                           min="0" step="0.01" value="<?php echo esc_attr($pricing['perGuestRate']); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_guest_question"><?php esc_html_e('Guest count question ID', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="text" class="regular-text" id="msf_pricing_guest_question" name="msf_pricing_guest_question"
                           value="<?php echo esc_attr($pricing['perGuestQuestionId']); ?>"
                           placeholder="q_guest_count">
                    <p class="description"><?php esc_html_e('Must match the number question id in your steps.', 'custom-multi-step-form'); ?></p>
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_display"><?php esc_html_e('Price display', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <select id="msf_pricing_display" name="msf_pricing_display">
                        <option value="summary" <?php selected($pricing['displayOn'], 'summary'); ?>><?php esc_html_e('Summary step only', 'custom-multi-step-form'); ?></option>
                        <option value="sticky" <?php selected($pricing['displayOn'], 'sticky'); ?>><?php esc_html_e('Sticky bar while filling form', 'custom-multi-step-form'); ?></option>
                        <option value="both" <?php selected($pricing['displayOn'], 'both'); ?>><?php esc_html_e('Sticky bar and summary', 'custom-multi-step-form'); ?></option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_currency"><?php esc_html_e('Currency', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="text" class="small-text" id="msf_pricing_currency" name="msf_pricing_currency"
                           value="<?php echo esc_attr($pricing['currency']); ?>">
                </td>
            </tr>
        </table>
        <p class="description">
            <?php esc_html_e('Option price effects are set per step in the builder (value|Label|+amount|guest). See the sample form Banketu piedāvājums for a full example.', 'custom-multi-step-form'); ?>
        </p>
        <?php
    }

    public function render_steps_meta_box($post) {
        $config = MSF_Form_Config::get($post->ID);
        $json   = wp_json_encode($config['steps'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        ?>
        <div id="msf-steps-builder" class="msf-steps-builder"></div>
        <p>
            <button type="button" class="button button-secondary" id="msf-add-step">
                <?php esc_html_e('Add step', 'custom-multi-step-form'); ?>
            </button>
        </p>
        <input type="hidden" id="msf_steps_json" name="msf_steps_json" value="<?php echo esc_attr(wp_json_encode($config['steps'], JSON_UNESCAPED_UNICODE)); ?>">
        <?php
    }

    public function render_entry_meta_box($post) {
        $form_id  = get_post_meta($post->ID, '_msf_entry_form_id', true);
        $answers  = get_post_meta($post->ID, '_msf_entry_answers', true);
        $pricing  = get_post_meta($post->ID, '_msf_entry_pricing', true);
        $page_url = get_post_meta($post->ID, '_msf_entry_page_url', true);

        if (!is_array($answers)) {
            $answers = array();
        }

        $form_title = $form_id ? get_the_title($form_id) : '—';
        ?>
        <p><strong><?php esc_html_e('Form:', 'custom-multi-step-form'); ?></strong> <?php echo esc_html($form_title); ?></p>
        <?php if ($page_url) : ?>
            <p><strong><?php esc_html_e('Page:', 'custom-multi-step-form'); ?></strong>
                <a href="<?php echo esc_url($page_url); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html($page_url); ?></a>
            </p>
        <?php endif; ?>
        <table class="widefat striped">
            <thead>
                <tr>
                    <th><?php esc_html_e('Question', 'custom-multi-step-form'); ?></th>
                    <th><?php esc_html_e('Answer', 'custom-multi-step-form'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($answers as $row) : ?>
                    <tr>
                        <td><?php echo esc_html(isset($row['label']) ? $row['label'] : ''); ?></td>
                        <td><?php echo esc_html(isset($row['display']) ? $row['display'] : ''); ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php if (is_array($pricing) && !empty($pricing['total'])) : ?>
            <h4><?php esc_html_e('Calculated price', 'custom-multi-step-form'); ?></h4>
            <p><strong><?php echo esc_html(MSF_Pricing::format_money($pricing['total'], isset($pricing['currency']) ? $pricing['currency'] : 'EUR')); ?></strong></p>
            <?php if (!empty($pricing['lines']) && is_array($pricing['lines'])) : ?>
                <ul>
                    <?php foreach ($pricing['lines'] as $line) : ?>
                        <li><?php echo esc_html($line['label']); ?>: <?php echo esc_html(MSF_Pricing::format_money($line['amount'], isset($pricing['currency']) ? $pricing['currency'] : 'EUR')); ?></li>
                    <?php endforeach; ?>
                </ul>
            <?php endif; ?>
        <?php endif; ?>
        <?php
    }

    public function save_form($post_id, $post) {
        if (!isset($_POST['msf_form_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['msf_form_nonce'])), 'msf_save_form')) {
            return;
        }

        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        $existing = MSF_Form_Config::get($post_id);
        if (!$existing) {
            $existing = MSF_Form_Config::default_config();
        }

        $existing['settings']['ownerEmail']           = isset($_POST['msf_owner_email']) ? sanitize_email(wp_unslash($_POST['msf_owner_email'])) : '';
        $existing['settings']['successMessage']       = isset($_POST['msf_success_message']) ? sanitize_textarea_field(wp_unslash($_POST['msf_success_message'])) : '';
        $existing['settings']['customerEmailSubject'] = isset($_POST['msf_customer_subject']) ? sanitize_text_field(wp_unslash($_POST['msf_customer_subject'])) : '';
        $existing['settings']['customerEmailBody']    = isset($_POST['msf_customer_body']) ? sanitize_textarea_field(wp_unslash($_POST['msf_customer_body'])) : '';
        $existing['settings']['submitLabel']          = isset($_POST['msf_submit_label']) ? sanitize_text_field(wp_unslash($_POST['msf_submit_label'])) : '';
        $existing['settings']['stepTransitionMs']     = isset($_POST['msf_step_transition_ms']) ? absint($_POST['msf_step_transition_ms']) : 400;

        $existing['pricing']['enabled']            = !empty($_POST['msf_pricing_enabled']);
        $existing['pricing']['baseAmount']         = isset($_POST['msf_pricing_base']) ? floatval($_POST['msf_pricing_base']) : 0;
        $existing['pricing']['perGuestRate']       = isset($_POST['msf_pricing_per_guest']) ? floatval($_POST['msf_pricing_per_guest']) : 0;
        $existing['pricing']['perGuestQuestionId'] = isset($_POST['msf_pricing_guest_question']) ? sanitize_key(wp_unslash($_POST['msf_pricing_guest_question'])) : '';
        $existing['pricing']['displayOn']          = isset($_POST['msf_pricing_display']) ? sanitize_key(wp_unslash($_POST['msf_pricing_display'])) : 'summary';
        $existing['pricing']['currency']           = isset($_POST['msf_pricing_currency']) ? sanitize_text_field(wp_unslash($_POST['msf_pricing_currency'])) : 'EUR';

        $steps = array();

        if (isset($_POST['msf_steps_json'])) {
            $decoded = json_decode(wp_unslash($_POST['msf_steps_json']), true);

            if (is_array($decoded)) {
                $steps = $decoded;
            }
        }

        $existing['steps'] = $steps;

        MSF_Form_Config::save($post_id, $existing);
    }
}
