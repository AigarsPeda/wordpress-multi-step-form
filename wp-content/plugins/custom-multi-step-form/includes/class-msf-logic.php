<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Logic {

    public static function is_visible($visibility, $answers) {
        $visibility = wp_parse_args(
            is_array($visibility) ? $visibility : array(),
            array('mode' => 'always')
        );

        if ($visibility['mode'] === 'never') {
            return false;
        }

        if ($visibility['mode'] !== 'conditional') {
            return true;
        }

        return self::evaluate_group($visibility, $answers);
    }

    public static function evaluate_group($group, $answers) {
        $logic      = isset($group['logic']) && $group['logic'] === 'or' ? 'or' : 'and';
        $conditions = isset($group['conditions']) && is_array($group['conditions']) ? $group['conditions'] : array();

        if (empty($conditions)) {
            return true;
        }

        if ($logic === 'or') {
            foreach ($conditions as $condition) {
                if (self::evaluate_condition($condition, $answers)) {
                    return true;
                }
            }

            return false;
        }

        foreach ($conditions as $condition) {
            if (!self::evaluate_condition($condition, $answers)) {
                return false;
            }
        }

        return true;
    }

    public static function evaluate_condition($condition, $answers) {
        if (!is_array($condition)) {
            return true;
        }

        $question_id = isset($condition['questionId']) ? sanitize_key($condition['questionId']) : '';
        $operator    = isset($condition['operator']) ? sanitize_key($condition['operator']) : 'equals';
        $expected    = isset($condition['value']) ? $condition['value'] : '';
        $actual      = $question_id !== '' && isset($answers[$question_id]) ? $answers[$question_id] : null;

        switch ($operator) {
            case 'notEquals':
                return (string) $actual !== (string) $expected;
            case 'greaterThan':
                return floatval($actual) > floatval($expected);
            case 'lessThan':
                return floatval($actual) < floatval($expected);
            case 'greaterOrEqual':
                return floatval($actual) >= floatval($expected);
            case 'lessOrEqual':
                return floatval($actual) <= floatval($expected);
            case 'contains':
                if (is_array($actual)) {
                    return in_array($expected, $actual, true);
                }
                return strpos((string) $actual, (string) $expected) !== false;
            case 'notContains':
                if (is_array($actual)) {
                    return !in_array($expected, $actual, true);
                }
                return strpos((string) $actual, (string) $expected) === false;
            case 'isEmpty':
                return $actual === null || $actual === '' || (is_array($actual) && empty($actual));
            case 'isNotEmpty':
                return !($actual === null || $actual === '' || (is_array($actual) && empty($actual)));
            case 'in':
                $list = is_array($expected) ? $expected : array_map('trim', explode(',', (string) $expected));
                if (is_array($actual)) {
                    return (bool) array_intersect($actual, $list);
                }
                return in_array((string) $actual, $list, true);
            case 'notIn':
                $list = is_array($expected) ? $expected : array_map('trim', explode(',', (string) $expected));
                if (is_array($actual)) {
                    return !array_intersect($actual, $list);
                }
                return !in_array((string) $actual, $list, true);
            case 'equals':
            default:
                if (is_array($actual)) {
                    return in_array($expected, $actual, true);
                }
                return (string) $actual === (string) $expected;
        }
    }

    public static function get_visible_steps($steps, $answers) {
        $visible = array();

        foreach ($steps as $step) {
            if (!is_array($step)) {
                continue;
            }

            $visibility = isset($step['visibility']) ? $step['visibility'] : array('mode' => 'always');

            if (!self::is_visible($visibility, $answers)) {
                continue;
            }

            $visible[] = $step;
        }

        return $visible;
    }
}
