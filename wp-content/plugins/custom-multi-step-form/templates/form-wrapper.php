<?php

if (!defined('ABSPATH')) {
    exit;
}

$form_id        = isset($form_id) ? absint($form_id) : 0;
$title          = isset($title) ? $title : '';
$public_config  = isset($public_config) ? $public_config : array();
$success_text   = isset($success_text) ? $success_text : '';
$page_url       = isset($page_url) ? $page_url : '';
$submit_nonce   = isset($submit_nonce) ? $submit_nonce : '';
$runtime_i18n   = isset($runtime_i18n) ? $runtime_i18n : array();
?>
<div
    class="msf-form"
    id="msf-form-<?php echo esc_attr($form_id); ?>"
    data-msf-form-id="<?php echo esc_attr($form_id); ?>"
    data-msf-config="<?php echo esc_attr(wp_json_encode($public_config)); ?>"
    data-msf-success="<?php echo esc_attr($success_text); ?>"
    data-msf-page-url="<?php echo esc_url($page_url); ?>"
    data-msf-ajax-url="<?php echo esc_url(admin_url('admin-ajax.php')); ?>"
    data-msf-nonce="<?php echo esc_attr($submit_nonce); ?>"
    data-msf-i18n="<?php echo esc_attr(wp_json_encode($runtime_i18n)); ?>"
>
    <?php if ($title) : ?>
        <h2 class="msf-form__title"><?php echo esc_html($title); ?></h2>
    <?php endif; ?>

    <div class="msf-form__progress" aria-hidden="true">
        <div class="msf-form__progress-bar"></div>
    </div>

    <div class="msf-form__price-bar" hidden></div>

    <div class="msf-form__body">
        <p class="msf-form__loading"><?php esc_html_e('Loading form…', 'custom-multi-step-form'); ?></p>
    </div>

    <div class="msf-form__honeypot" aria-hidden="true">
        <label for="msf-hp-<?php echo esc_attr($form_id); ?>">Leave empty</label>
        <input type="text" id="msf-hp-<?php echo esc_attr($form_id); ?>" name="msf_hp" tabindex="-1" autocomplete="off">
    </div>
</div>
