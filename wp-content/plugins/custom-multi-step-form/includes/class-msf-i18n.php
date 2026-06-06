<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Front-end strings (Latvian for v1).
 * Wrapped in __() for future translation files; msgids are Latvian.
 */
class MSF_I18n {

    public static function runtime_strings() {
        $strings = array(
            'required'        => __('Šis lauks ir obligāts.', 'custom-multi-step-form'),
            'submitting'      => __('Nosūta…', 'custom-multi-step-form'),
            'error'           => __('Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.', 'custom-multi-step-form'),
            'estimatedPrice'  => __('Aptuvenā cena', 'custom-multi-step-form'),
            'summaryTitle'    => __('Kopsavilkums', 'custom-multi-step-form'),
            'yourAnswers'     => __('Jūsu atbildes', 'custom-multi-step-form'),
            'total'           => __('Kopā', 'custom-multi-step-form'),
            'consentAccepted' => __('Piekrīts', 'custom-multi-step-form'),
            'fileHint'        => __('Maks. %s MB (JPG, PNG, PDF, DOC)', 'custom-multi-step-form'),
            'previewSubmit'   => __('Priekšskatījums — saglabājiet formu un skatiet lapā, lai nosūtītu.', 'custom-multi-step-form'),
            'loading'             => __('Ielādē formu…', 'custom-multi-step-form'),
            'datePlaceholder'     => __('dd/mm/yyyy', 'custom-multi-step-form'),
            'dateAfterWeek'       => __('Pēc nedēļas', 'custom-multi-step-form'),
            'dateAfterMonth'      => __('Pēc mēneša', 'custom-multi-step-form'),
            'dateAfterThreeMonths'=> __('Pēc 3 mēnešiem', 'custom-multi-step-form'),
            'invalidEmail'        => __('Lūdzu, ievadiet derīgu e-pasta adresi.', 'custom-multi-step-form'),
            'invalidPhone'        => __('Lūdzu, ievadiet derīgu tālruņa numuru.', 'custom-multi-step-form'),
            'invalidDate'         => __('Lūdzu, ievadiet derīgu datumu.', 'custom-multi-step-form'),
            'progressLabel'       => __('Formas progress', 'custom-multi-step-form'),
        );

        return apply_filters('msf_runtime_i18n', $strings);
    }

    public static function submit_error_strings() {
        return array(
            'session_expired'  => __('Sesija beigusies. Lūdzu, atsvaidziniet lapu un mēģiniet vēlreiz.', 'custom-multi-step-form'),
            'invalid_submit'   => __('Nederīgs pieteikums.', 'custom-multi-step-form'),
            'form_not_found'   => __('Forma nav atrasta.', 'custom-multi-step-form'),
            'not_configured'   => __('Forma nav konfigurēta.', 'custom-multi-step-form'),
            'save_failed'      => __('Neizdevās saglabāt pieteikumu.', 'custom-multi-step-form'),
            'required_field'   => __('Lūdzu, atbildiet: %s', 'custom-multi-step-form'),
            'invalid_email'    => __('Lūdzu, ievadiet derīgu e-pasta adresi.', 'custom-multi-step-form'),
            'invalid_phone'    => __('Lūdzu, ievadiet derīgu tālruņa numuru.', 'custom-multi-step-form'),
            'invalid_answer'   => __('Izvēlēta nederīga atbilde.', 'custom-multi-step-form'),
            'invalid_date'     => __('Lūdzu, ievadiet derīgu datumu.', 'custom-multi-step-form'),
            'invalid_file'     => __('Nederīga faila augšupielāde.', 'custom-multi-step-form'),
            'consent_required' => __('Nepieciešama piekrišana.', 'custom-multi-step-form'),
            'upload_failed'    => __('Faila augšupielāde neizdevās.', 'custom-multi-step-form'),
            'file_too_large'   => __('Fails ir pārāk liels.', 'custom-multi-step-form'),
        );
    }
}
