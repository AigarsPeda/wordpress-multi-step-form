<?php
/**
 * Plugin Name: Custom Multi Step Form
 * Description: Configurable multi-step form block for many different use cases.
 * Version: 0.7.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: A.Pēda
 * Text Domain: custom-multi-step-form
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MSF_PLUGIN_FILE', __FILE__);
define('MSF_PLUGIN_DIR', plugin_dir_path(MSF_PLUGIN_FILE));
define('MSF_PLUGIN_URL', plugin_dir_url(MSF_PLUGIN_FILE));
define('MSF_VERSION', '0.7.0');

require_once MSF_PLUGIN_DIR . 'includes/class-msf-mail.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-upload.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-logic.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-pricing.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-i18n.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-validation.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-rate-limit.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-form-config.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-seeder.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-cpt.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-settings.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-admin.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-admin-actions.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-submit.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-block.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-page-layout.php';
require_once MSF_PLUGIN_DIR . 'includes/class-msf-plugin.php';

function msf_plugin() {
    return MSF_Plugin::instance();
}

msf_plugin();

register_activation_hook(__FILE__, function () {
    msf_plugin()->activate();
    set_transient('custom_msf_just_activated', 1, MINUTE_IN_SECONDS * 5);
});

add_action('admin_notices', function () {
    if (!get_transient('custom_msf_just_activated')) {
        return;
    }

    delete_transient('custom_msf_just_activated');

    if (!current_user_can('edit_posts')) {
        return;
    }

    echo '<div class="notice notice-success is-dismissible"><p>';
    echo esc_html__('Custom Multi Step Form is active. Create a form under Multi Step Forms, then add the block to a page.', 'custom-multi-step-form');
    echo '</p></div>';
});
