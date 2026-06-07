<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Page_Layout {

    public function __construct() {
        add_filter('body_class', array($this, 'add_body_classes'));
    }

    /**
     * @return int[]
     */
    public static function get_form_ids_for_post($post) {
        if (!$post || empty($post->post_content)) {
            return array();
        }

        if (!has_blocks($post->post_content)) {
            return array();
        }

        $form_ids = array();
        $blocks   = parse_blocks($post->post_content);
        self::collect_form_ids_from_blocks($blocks, $form_ids);

        return array_values(array_unique(array_filter(array_map('absint', $form_ids))));
    }

    /**
     * @param array $blocks
     * @param int[] $form_ids
     */
    private static function collect_form_ids_from_blocks($blocks, &$form_ids) {
        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }

            if (!empty($block['blockName']) && $block['blockName'] === 'custom-msf/form') {
                $form_id = isset($block['attrs']['formId']) ? absint($block['attrs']['formId']) : 0;

                if ($form_id) {
                    $form_ids[] = $form_id;
                }
            }

            if (!empty($block['innerBlocks']) && is_array($block['innerBlocks'])) {
                self::collect_form_ids_from_blocks($block['innerBlocks'], $form_ids);
            }
        }
    }

    public function add_body_classes($classes) {
        if (!is_singular()) {
            return $classes;
        }

        $post = get_queried_object();

        if (!$post || empty($post->post_content)) {
            return $classes;
        }

        $form_ids = self::get_form_ids_for_post($post);

        if (empty($form_ids)) {
            return $classes;
        }

        $classes[] = 'has-msf-form';

        foreach ($form_ids as $form_id) {
            $classes[] = 'has-msf-form-' . $form_id;
        }

        return $classes;
    }

    public static function default_avada_page_css() {
        return <<<'CSS'
/* Page layout when this form is embedded (Avada / Jāņoga). Body class: has-msf-form */
body.has-msf-form #wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

body.has-msf-form #main {
  flex: 1 0 auto;
  padding-bottom: 0 !important;
}

body.has-msf-form #main > .fusion-row,
body.has-msf-form #main #content {
  width: 100%;
}

body.has-msf-form .fusion-footer {
  flex-shrink: 0;
}

@media (min-width: 768px) {
  body.has-msf-form #main {
    padding-top: 50px;
  }
}
CSS;
    }
}
