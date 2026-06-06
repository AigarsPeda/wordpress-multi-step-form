<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Seeder {

    const OPTION_KEY = 'msf_sample_form_seeded';

    public static function get_banquet_quote_config() {
        $config = MSF_Form_Config::default_config();

        $config['settings']['ownerEmail']           = '';
        $config['settings']['successMessage']       = 'Paldies! Jūsu banketa pieteikums ir saņemts. Sazināsimies ar Jums tuvākajā laikā.';
        $config['settings']['customerEmailSubject'] = 'Jūsu banketa pieteikums — Jāņoga';
        $config['settings']['customerEmailBody']    = "Sveiki!\n\nPaldies, ka iesniedzāt banketa pieteikumu. Esam saņēmuši Jūsu atbildes un sazināsimies ar Jums drīzumā.\n\nAr cieņu,\nJāņoga komanda";
        $config['settings']['submitLabel']          = 'Nosūtīt pieteikumu';
        $config['settings']['nextLabel']            = 'Tālāk';
        $config['settings']['backLabel']            = 'Atpakaļ';

        $config['pricing']['enabled'] = false;

        $config['steps'] = array(
            array(
                'id'          => 'step_guests',
                'title'       => 'Viesu skaits',
                'description' => '',
                'questions'   => array(
                    array(
                        'id'          => 'q_guest_count',
                        'type'        => 'number',
                        'label'       => 'Cik viesu plānojat?',
                        'description' => 'Norādiet aptuveno viesu skaitu.',
                        'required'    => true,
                        'validation'  => array('min' => 1, 'max' => 500),
                        'options'     => array(),
                    ),
                ),
            ),
            array(
                'id'          => 'step_event_type',
                'title'       => 'Pasākuma veids',
                'description' => '',
                'questions'   => array(
                    array(
                        'id'       => 'q_event_type',
                        'type'     => 'radio',
                        'label'    => 'Izvēlieties pasākuma veidu',
                        'required' => true,
                        'options'  => array(
                            array('value' => 'wedding', 'label' => 'Kāzas'),
                            array('value' => 'corporate', 'label' => 'Korporatīvs pasākums'),
                            array('value' => 'private', 'label' => 'Privāts pasākums'),
                            array('value' => 'other', 'label' => 'Cits'),
                        ),
                    ),
                ),
            ),
            array(
                'id'          => 'step_menu',
                'title'       => 'Ēdināšana',
                'description' => '',
                'questions'   => array(
                    array(
                        'id'       => 'q_menu_type',
                        'type'     => 'radio',
                        'label'    => 'Kādu ēdināšanas formātu vēlaties?',
                        'required' => true,
                        'options'  => array(
                            array('value' => 'buffet', 'label' => 'Bufets'),
                            array('value' => 'plated', 'label' => 'Porcijās pasniegts'),
                            array('value' => 'coffee', 'label' => 'Kafijas pauze / uzkodas'),
                        ),
                    ),
                ),
            ),
            array(
                'id'          => 'step_date',
                'title'       => 'Datums',
                'description' => '',
                'questions'   => array(
                    array(
                        'id'          => 'q_event_date',
                        'type'        => 'text',
                        'label'       => 'Vēlamais pasākuma datums',
                        'description' => 'Piemēram: 15.08.2026',
                        'required'    => true,
                        'options'     => array(),
                    ),
                ),
            ),
            array(
                'id'          => 'step_notes',
                'title'       => 'Papildu informācija',
                'description' => '',
                'questions'   => array(
                    array(
                        'id'       => 'q_notes',
                        'type'     => 'textarea',
                        'label'    => 'Īss apraksts vai īpašas vēlmes (neobligāti)',
                        'required' => false,
                        'options'  => array(),
                    ),
                ),
            ),
            array(
                'id'          => 'step_name',
                'title'       => 'Kontakti',
                'description' => '',
                'questions'   => array(
                    array(
                        'id'       => 'q_name',
                        'type'     => 'text',
                        'label'    => 'Jūsu vārds, uzvārds',
                        'required' => true,
                        'options'  => array(),
                    ),
                ),
            ),
            array(
                'id'          => 'step_phone',
                'title'       => '',
                'description' => '',
                'questions'   => array(
                    array(
                        'id'       => 'q_phone',
                        'type'     => 'text',
                        'label'    => 'Tālruņa numurs',
                        'required' => true,
                        'options'  => array(),
                    ),
                ),
            ),
            array(
                'id'          => 'step_email',
                'title'       => '',
                'description' => '',
                'questions'   => array(
                    array(
                        'id'       => 'q_email',
                        'type'     => 'email',
                        'label'    => 'E-pasta adrese',
                        'required' => true,
                        'options'  => array(),
                    ),
                ),
            ),
        );

        return MSF_Form_Config::normalize($config);
    }

    /**
     * @return int Post ID or 0 on failure.
     */
    public static function create_banquet_quote_form() {
        $existing = get_page_by_title('Banketu piedāvājums', OBJECT, 'msf_form');

        if ($existing instanceof WP_Post) {
            $form_id = (int) $existing->ID;
            MSF_Form_Config::save($form_id, self::get_banquet_quote_config());
            update_option(self::OPTION_KEY, $form_id);

            return $form_id;
        }

        $post_id = wp_insert_post(array(
            'post_type'   => 'msf_form',
            'post_status' => 'publish',
            'post_title'  => 'Banketu piedāvājums',
            'post_author' => get_current_user_id() ? get_current_user_id() : 1,
        ), true);

        if (is_wp_error($post_id)) {
            return 0;
        }

        MSF_Form_Config::save($post_id, self::get_banquet_quote_config());
        update_option(self::OPTION_KEY, (int) $post_id);

        return (int) $post_id;
    }

    public static function is_msf_admin_screen($screen) {
        if (!$screen) {
            return false;
        }

        $allowed = array(
            'edit-msf_form',
            'msf_form',
            'multi-step-form_page_msf-form-settings',
        );

        return in_array($screen->id, $allowed, true);
    }

    public static function maybe_seed_sample_form($screen) {
        if (!$screen instanceof WP_Screen) {
            return;
        }

        if (!self::is_msf_admin_screen($screen)) {
            return;
        }

        if (!current_user_can('edit_posts')) {
            return;
        }

        if (self::handle_manual_seed_request()) {
            return;
        }

        $stored_id = absint(get_option(self::OPTION_KEY, 0));

        if ($stored_id && get_post($stored_id) && get_post_type($stored_id) === 'msf_form') {
            return;
        }

        delete_option(self::OPTION_KEY);

        $count = wp_count_posts('msf_form');

        if (!$count || ((int) $count->publish + (int) $count->draft) > 0) {
            return;
        }

        self::create_banquet_quote_form();
    }

    public static function handle_manual_seed_request() {
        if (!isset($_GET['msf_seed']) || !isset($_GET['_wpnonce'])) {
            return false;
        }

        if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_GET['_wpnonce'])), 'msf_seed_sample')) {
            return false;
        }

        if (!current_user_can('edit_posts')) {
            return false;
        }

        $form_id = self::create_banquet_quote_form();

        if ($form_id) {
            wp_safe_redirect(get_edit_post_link($form_id, 'raw'));
            exit;
        }

        return true;
    }

    public static function get_seed_url() {
        return wp_nonce_url(
            add_query_arg(
                array(
                    'post_type' => 'msf_form',
                    'msf_seed'  => '1',
                ),
                admin_url('edit.php')
            ),
            'msf_seed_sample'
        );
    }

    public static function render_empty_forms_notice() {
        if (!current_user_can('edit_posts')) {
            return;
        }

        $screen = function_exists('get_current_screen') ? get_current_screen() : null;

        if (!$screen || $screen->id !== 'edit-msf_form') {
            return;
        }

        if (isset($_GET['msf_seed'])) {
            return;
        }

        $count = wp_count_posts('msf_form');
        $total = $count ? ((int) $count->publish + (int) $count->draft + (int) $count->pending) : 0;

        if ($total > 0) {
            return;
        }

        echo '<div class="notice notice-info"><p>';
        echo esc_html__('No forms yet.', 'custom-multi-step-form');
        echo ' <a class="button button-primary" href="' . esc_url(self::get_seed_url()) . '">';
        esc_html_e('Create sample form: Banketu piedāvājums', 'custom-multi-step-form');
        echo '</a>';
        echo '</p></div>';
    }
}
