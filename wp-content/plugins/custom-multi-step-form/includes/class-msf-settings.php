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
    }

    public function render_page() {
        if (!current_user_can('edit_posts')) {
            return;
        }

        $email = get_option(self::OPTION_EMAIL, '');
        $seed_url = MSF_Seeder::get_seed_url();
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
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
