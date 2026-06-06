<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Settings {

    const OPTION_EMAIL = 'msf_default_owner_email';

    public function __construct() {
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    public function add_settings_page() {
        add_submenu_page(
            'edit.php?post_type=msf_form',
            __('Form Settings', 'custom-multi-step-form'),
            __('Form Settings', 'custom-multi-step-form'),
            'edit_posts',
            'msf-form-settings',
            array($this, 'render_page')
        );
    }

    public function register_settings() {
        register_setting(
            'msf_settings',
            self::OPTION_EMAIL,
            array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_email',
                'default'           => '',
            )
        );

        register_setting(
            'msf_settings',
            MSF_Rate_Limit::OPTION_KEY,
            array(
                'type'              => 'array',
                'sanitize_callback' => array('MSF_Rate_Limit', 'sanitize_settings'),
                'default'           => MSF_Rate_Limit::DEFAULTS,
            )
        );
    }

    public function render_page() {
        if (!current_user_can('edit_posts')) {
            return;
        }

        $email       = get_option(self::OPTION_EMAIL, '');
        $rate_limit  = MSF_Rate_Limit::get_settings();
        $seed_url    = MSF_Seeder::get_seed_url();
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Form Settings', 'custom-multi-step-form'); ?></h1>
            <p>
                <a href="<?php echo esc_url($seed_url); ?>" class="button button-secondary">
                    <?php esc_html_e('Create sample form: Banketu piedāvājums', 'custom-multi-step-form'); ?>
                </a>
            </p>
            <p class="description">
                <?php esc_html_e('Site-wide defaults. Per-form settings on each form override the owner email.', 'custom-multi-step-form'); ?>
            </p>

            <div class="notice notice-info inline" style="margin: 1em 0; padding: 12px;">
                <p><strong><?php esc_html_e('Email delivery', 'custom-multi-step-form'); ?></strong></p>
                <p><?php echo esc_html(MSF_Mail::get_delivery_description()); ?></p>
                <?php if (MSF_Mail::uses_wp_mail_smtp()) : ?>
                    <p>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=wp-mail-smtp')); ?>">
                            <?php esc_html_e('Open WP Mail SMTP settings', 'custom-multi-step-form'); ?>
                        </a>
                    </p>
                <?php endif; ?>
            </div>

            <form method="post" action="options.php">
                <?php settings_fields('msf_settings'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="msf_default_owner_email"><?php esc_html_e('Default owner email', 'custom-multi-step-form'); ?></label>
                        </th>
                        <td>
                            <input
                                type="email"
                                id="msf_default_owner_email"
                                name="<?php echo esc_attr(self::OPTION_EMAIL); ?>"
                                value="<?php echo esc_attr($email); ?>"
                                class="regular-text"
                                placeholder="owner@example.com"
                            />
                            <p class="description">
                                <?php esc_html_e('Used when a form has no owner email set. Submission notifications are sent here.', 'custom-multi-step-form'); ?>
                            </p>
                        </td>
                    </tr>
                </table>

                <h2><?php esc_html_e('Spam protection', 'custom-multi-step-form'); ?></h2>
                <p class="description">
                    <?php esc_html_e('Limits how many submissions one visitor can send per form within a time window. Uses the visitor IP address (no external service).', 'custom-multi-step-form'); ?>
                </p>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><?php esc_html_e('Rate limiting', 'custom-multi-step-form'); ?></th>
                        <td>
                            <label>
                                <input
                                    type="checkbox"
                                    name="<?php echo esc_attr(MSF_Rate_Limit::OPTION_KEY); ?>[enabled]"
                                    value="1"
                                    <?php checked($rate_limit['enabled']); ?>
                                >
                                <?php esc_html_e('Enable rate limiting', 'custom-multi-step-form'); ?>
                            </label>
                            <p class="description">
                                <?php esc_html_e('Works together with the honeypot field. Logged-in administrators are not limited.', 'custom-multi-step-form'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="msf_rate_limit_max"><?php esc_html_e('Max submissions', 'custom-multi-step-form'); ?></label>
                        </th>
                        <td>
                            <input
                                type="number"
                                id="msf_rate_limit_max"
                                name="<?php echo esc_attr(MSF_Rate_Limit::OPTION_KEY); ?>[maxSubmissions]"
                                value="<?php echo esc_attr($rate_limit['maxSubmissions']); ?>"
                                min="0"
                                max="100"
                                step="1"
                                class="small-text"
                            >
                            <p class="description">
                                <?php esc_html_e('Per visitor IP and form. Set to 0 to disable counting (even if the checkbox is on).', 'custom-multi-step-form'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="msf_rate_limit_window"><?php esc_html_e('Time window (minutes)', 'custom-multi-step-form'); ?></label>
                        </th>
                        <td>
                            <input
                                type="number"
                                id="msf_rate_limit_window"
                                name="<?php echo esc_attr(MSF_Rate_Limit::OPTION_KEY); ?>[windowMinutes]"
                                value="<?php echo esc_attr($rate_limit['windowMinutes']); ?>"
                                min="1"
                                max="1440"
                                step="1"
                                class="small-text"
                            >
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
