<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_CPT {

    public function __construct() {
        add_action('init', array($this, 'register_post_types'));
    }

    public function register_post_types() {
        register_post_type('msf_form', array(
            'labels' => array(
                'name'               => __('Multi Step Forms', 'custom-multi-step-form'),
                'singular_name'      => __('Form', 'custom-multi-step-form'),
                'menu_name'          => __('Multi Step Forms', 'custom-multi-step-form'),
                'add_new'            => __('Add New', 'custom-multi-step-form'),
                'add_new_item'       => __('Add New Form', 'custom-multi-step-form'),
                'edit_item'          => __('Edit Form', 'custom-multi-step-form'),
                'new_item'           => __('New Form', 'custom-multi-step-form'),
                'view_item'          => __('View Form', 'custom-multi-step-form'),
                'search_items'       => __('Search Forms', 'custom-multi-step-form'),
                'not_found'          => __('No forms found', 'custom-multi-step-form'),
                'all_items'          => __('All Forms', 'custom-multi-step-form'),
            ),
            'public'              => false,
            'publicly_queryable'  => false,
            'show_ui'             => true,
            'show_in_menu'        => true,
            'show_in_rest'        => false,
            'has_archive'         => false,
            'hierarchical'        => false,
            'menu_position'       => 26,
            'menu_icon'           => 'dashicons-feedback',
            'supports'            => array('title'),
            'capability_type'     => 'post',
            'map_meta_cap'        => true,
        ));

        register_post_type('msf_entry', array(
            'labels' => array(
                'name'          => __('Submissions', 'custom-multi-step-form'),
                'singular_name' => __('Submission', 'custom-multi-step-form'),
                'menu_name'     => __('Submissions', 'custom-multi-step-form'),
                'all_items'     => __('Submissions', 'custom-multi-step-form'),
                'edit_item'     => __('View Submission', 'custom-multi-step-form'),
                'search_items'  => __('Search Submissions', 'custom-multi-step-form'),
                'not_found'     => __('No submissions found', 'custom-multi-step-form'),
            ),
            'public'              => false,
            'publicly_queryable'  => false,
            'show_ui'             => true,
            'show_in_menu'        => 'edit.php?post_type=msf_form',
            'show_in_rest'        => false,
            'has_archive'         => false,
            'hierarchical'        => false,
            'supports'            => array('title'),
            'capability_type'     => 'post',
            'map_meta_cap'        => true,
            'capabilities'        => array(
                'create_posts' => 'do_not_allow',
            ),
        ));
    }
}
