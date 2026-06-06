<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Admin_Actions {

    public function __construct() {
        add_filter('post_row_actions', array($this, 'row_actions'), 10, 2);
        add_action('admin_action_msf_duplicate_form', array($this, 'duplicate_form'));
        add_action('admin_action_msf_export_form', array($this, 'export_form'));
        add_action('post_submitbox_misc_actions', array($this, 'submitbox_duplicate_link'));
    }

    public function row_actions($actions, $post) {
        if ($post->post_type !== 'msf_form' || !current_user_can('edit_post', $post->ID)) {
            return $actions;
        }

        $duplicate_url = wp_nonce_url(
            admin_url('admin.php?action=msf_duplicate_form&post=' . $post->ID),
            'msf_duplicate_' . $post->ID
        );

        $export_url = wp_nonce_url(
            admin_url('admin.php?action=msf_export_form&post=' . $post->ID),
            'msf_export_' . $post->ID
        );

        $actions['msf_duplicate'] = '<a href="' . esc_url($duplicate_url) . '">' . esc_html__('Duplicate', 'custom-multi-step-form') . '</a>';
        $actions['msf_export']    = '<a href="' . esc_url($export_url) . '">' . esc_html__('Export JSON', 'custom-multi-step-form') . '</a>';

        return $actions;
    }

    public function submitbox_duplicate_link($post) {
        if ($post->post_type !== 'msf_form' || !current_user_can('edit_post', $post->ID)) {
            return;
        }

        $duplicate_url = wp_nonce_url(
            admin_url('admin.php?action=msf_duplicate_form&post=' . $post->ID),
            'msf_duplicate_' . $post->ID
        );
        ?>
        <div class="misc-pub-section msf-duplicate-link">
            <a href="<?php echo esc_url($duplicate_url); ?>"><?php esc_html_e('Duplicate form', 'custom-multi-step-form'); ?></a>
        </div>
        <?php
    }

    public function duplicate_form() {
        $post_id = isset($_GET['post']) ? absint($_GET['post']) : 0;

        if (!$post_id || get_post_type($post_id) !== 'msf_form') {
            wp_die(esc_html__('Invalid form.', 'custom-multi-step-form'));
        }

        check_admin_referer('msf_duplicate_' . $post_id);

        if (!current_user_can('edit_post', $post_id)) {
            wp_die(esc_html__('You do not have permission to duplicate this form.', 'custom-multi-step-form'));
        }

        $config = MSF_Form_Config::get($post_id);

        if (!$config) {
            wp_die(esc_html__('Form configuration not found.', 'custom-multi-step-form'));
        }

        $new_id = wp_insert_post(array(
            'post_type'   => 'msf_form',
            'post_status' => 'draft',
            'post_title'  => sprintf(
                /* translators: %s: original form title */
                __('%s (Copy)', 'custom-multi-step-form'),
                get_the_title($post_id)
            ),
            'post_author' => get_current_user_id() ? get_current_user_id() : 1,
        ), true);

        if (is_wp_error($new_id)) {
            wp_die(esc_html__('Could not duplicate form.', 'custom-multi-step-form'));
        }

        MSF_Form_Config::save($new_id, $config);

        wp_safe_redirect(get_edit_post_link($new_id, 'raw'));
        exit;
    }

    public function export_form() {
        $post_id = isset($_GET['post']) ? absint($_GET['post']) : 0;

        if (!$post_id || get_post_type($post_id) !== 'msf_form') {
            wp_die(esc_html__('Invalid form.', 'custom-multi-step-form'));
        }

        check_admin_referer('msf_export_' . $post_id);

        if (!current_user_can('edit_post', $post_id)) {
            wp_die(esc_html__('You do not have permission to export this form.', 'custom-multi-step-form'));
        }

        $config = MSF_Form_Config::get($post_id);

        if (!$config) {
            wp_die(esc_html__('Form configuration not found.', 'custom-multi-step-form'));
        }

        $export = array(
            'exportedAt'  => gmdate('c'),
            'formTitle'   => get_the_title($post_id),
            'schemaVersion' => isset($config['schemaVersion']) ? $config['schemaVersion'] : 3,
            'settings'    => $config['settings'],
            'pricing'     => $config['pricing'],
            'steps'       => $config['steps'],
        );

        $filename = sanitize_file_name(get_post_field('post_name', $post_id));
        if ($filename === '') {
            $filename = 'msf-form-' . $post_id;
        }

        nocache_headers();
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '.json"');

        echo wp_json_encode($export, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
}
