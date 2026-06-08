<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Pricing {

    public static function calculate($config, $answers) {
        $pricing = isset($config['pricing']) && is_array($config['pricing']) ? $config['pricing'] : array();

        if (empty($pricing['enabled'])) {
            return array(
                'total'    => 0,
                'lines'    => array(),
                'currency' => self::get_currency($pricing),
            );
        }

        $total    = floatval(isset($pricing['baseAmount']) ? $pricing['baseAmount'] : 0);
        $lines    = array();
        $currency = self::get_currency($pricing);

        if ($total > 0) {
            $lines[] = array(
                'label'  => __('Bāzes maksa', 'custom-multi-step-form'),
                'amount' => $total,
            );
        }

        $guest_count = self::get_guest_count($pricing, $answers, $config);

        $per_guest_rate = floatval(isset($pricing['perGuestRate']) ? $pricing['perGuestRate'] : 0);

        if ($per_guest_rate > 0 && $guest_count > 0) {
            $guest_line_amount = $per_guest_rate * $guest_count;
            $total            += $guest_line_amount;
            $lines[]           = array(
                /* translators: %d: guest count */
                'label'  => sprintf(__('Ēdiens (%d viesi × %s)', 'custom-multi-step-form'), $guest_count, self::format_money($per_guest_rate, $currency)),
                'amount' => $guest_line_amount,
            );
        }

        $steps = MSF_Logic::get_visible_steps(
            isset($config['steps']) && is_array($config['steps']) ? $config['steps'] : array(),
            $answers
        );

        foreach ($steps as $step) {
            if ((isset($step['type']) && $step['type'] === 'summary') || empty($step['questions']) || !is_array($step['questions'])) {
                continue;
            }

            foreach ($step['questions'] as $question) {
                if (empty($question['id']) || !in_array($question['type'], array('radio', 'checkbox'), true)) {
                    continue;
                }

                $answer = isset($answers[$question['id']]) ? $answers[$question['id']] : null;

                if ($answer === null || $answer === '') {
                    continue;
                }

                $selected = is_array($answer) ? $answer : array($answer);

                foreach ($question['options'] as $option) {
                    if (!in_array($option['value'], $selected, true)) {
                        continue;
                    }

                    $effect = isset($option['priceEffect']) && is_array($option['priceEffect']) ? $option['priceEffect'] : null;

                    if (!$effect) {
                        continue;
                    }

                    $line = self::apply_price_effect($option['label'], $effect, $guest_count, $currency);

                    if ($line) {
                        $total  += $line['amount'];
                        $lines[] = $line;
                    }
                }
            }
        }

        return array(
            'total'    => round($total, 2),
            'lines'    => $lines,
            'currency' => $currency,
        );
    }

    private static function apply_price_effect($label, $effect, $guest_count, $currency) {
        $amount = 0;

        if (isset($effect['add'])) {
            $amount = floatval($effect['add']);

            if (!empty($effect['perGuest'])) {
                $amount *= max(1, $guest_count);
            }
        }

        if (isset($effect['multiply']) && floatval($effect['multiply']) > 0) {
            $amount = floatval($effect['multiply']);
        }

        if ($amount <= 0) {
            return null;
        }

        return array(
            'label'  => $label,
            'amount' => $amount,
        );
    }

    private static function get_guest_count($pricing, $answers, $config) {
        $question_id = isset($pricing['perGuestQuestionId']) ? sanitize_key($pricing['perGuestQuestionId']) : '';

        if ($question_id && isset($answers[$question_id])) {
            return max(0, floatval($answers[$question_id]));
        }

        return 0;
    }

    public static function get_currency($pricing) {
        $currency = isset($pricing['currency']) ? strtoupper(sanitize_text_field($pricing['currency'])) : 'EUR';

        return $currency !== '' ? $currency : 'EUR';
    }

    public static function format_money($amount, $currency = 'EUR') {
        $formatted = number_format_i18n((float) $amount, 2);

        if ($currency === 'EUR') {
            return $formatted . ' €';
        }

        return $formatted . ' ' . $currency;
    }

    public static function format_result_for_email($pricing_result) {
        if (empty($pricing_result['lines'])) {
            return MSF_Pricing::format_money($pricing_result['total'], $pricing_result['currency']);
        }

        $lines   = array();
        $lines[] = __('Aprēķinātā cena:', 'custom-multi-step-form');

        foreach ($pricing_result['lines'] as $line) {
            $lines[] = '  - ' . $line['label'] . ': ' . self::format_money($line['amount'], $pricing_result['currency']);
        }

        $lines[] = __('Kopā:', 'custom-multi-step-form') . ' ' . self::format_money($pricing_result['total'], $pricing_result['currency']);

        return implode("\n", $lines);
    }
}
