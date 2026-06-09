<?php

if (!defined('ABSPATH')) {
    exit;
}

class MSF_Admin {

    public function __construct() {
        add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
        add_action('save_post_msf_form', array($this, 'save_form'), 10, 2);
        add_action('admin_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('add_meta_boxes', array($this, 'add_entry_meta_boxes'));
    }

    public function add_meta_boxes() {
        add_meta_box(
            'msf_form_settings',
            __('Form settings', 'custom-multi-step-form'),
            array($this, 'render_settings_meta_box'),
            'msf_form',
            'normal',
            'high'
        );

        add_meta_box(
            'msf_form_steps',
            __('Form steps (one question per step)', 'custom-multi-step-form'),
            array($this, 'render_steps_meta_box'),
            'msf_form',
            'normal',
            'default'
        );

        add_meta_box(
            'msf_form_import_export',
            __('Import / Export', 'custom-multi-step-form'),
            array($this, 'render_import_export_meta_box'),
            'msf_form',
            'side',
            'default'
        );

        add_meta_box(
            'msf_form_preview',
            __('Live preview', 'custom-multi-step-form'),
            array($this, 'render_preview_meta_box'),
            'msf_form',
            'side',
            'low'
        );
    }

    public function add_entry_meta_boxes() {
        add_meta_box(
            'msf_entry_details',
            __('Submission details', 'custom-multi-step-form'),
            array($this, 'render_entry_meta_box'),
            'msf_entry',
            'normal',
            'high'
        );
    }

    public function enqueue_scripts($hook) {
        global $post;

        if (!in_array($hook, array('post.php', 'post-new.php'), true)) {
            return;
        }

        if (!$post || $post->post_type !== 'msf_form') {
            return;
        }

        wp_enqueue_style(
            'msf-admin',
            MSF_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            msf_plugin()->get_asset_version('assets/css/admin.css')
        );

        wp_enqueue_script('jquery-ui-sortable');

        wp_enqueue_style(
            'drawflow',
            MSF_PLUGIN_URL . 'assets/vendor/drawflow/drawflow.min.css',
            array(),
            '0.0.60'
        );

        wp_enqueue_style(
            'msf-admin-flow',
            MSF_PLUGIN_URL . 'assets/css/admin-flow.css',
            array('drawflow', 'msf-admin'),
            msf_plugin()->get_asset_version('assets/css/admin-flow.css')
        );

        wp_enqueue_script(
            'drawflow',
            MSF_PLUGIN_URL . 'assets/vendor/drawflow/drawflow.min.js',
            array(),
            '0.0.60',
            true
        );

        wp_enqueue_script(
            'msf-admin-flow-decompiler',
            MSF_PLUGIN_URL . 'assets/js/admin-flow-decompiler.js',
            array(),
            msf_plugin()->get_asset_version('assets/js/admin-flow-decompiler.js'),
            true
        );

        wp_enqueue_script(
            'msf-admin-flow-layout',
            MSF_PLUGIN_URL . 'assets/js/admin-flow-layout.js',
            array('msf-admin-flow-decompiler'),
            msf_plugin()->get_asset_version('assets/js/admin-flow-layout.js'),
            true
        );

        wp_enqueue_script(
            'msf-admin-builder',
            MSF_PLUGIN_URL . 'assets/js/admin-builder.js',
            array('jquery', 'jquery-ui-sortable'),
            msf_plugin()->get_asset_version('assets/js/admin-builder.js'),
            true
        );

        wp_enqueue_script(
            'msf-admin-flow-compiler',
            MSF_PLUGIN_URL . 'assets/js/admin-flow-compiler.js',
            array(),
            msf_plugin()->get_asset_version('assets/js/admin-flow-compiler.js'),
            true
        );

        wp_enqueue_script(
            'msf-admin-flow',
            MSF_PLUGIN_URL . 'assets/js/admin-flow.js',
            array('jquery', 'drawflow', 'msf-admin-flow-layout', 'msf-admin-flow-compiler', 'msf-admin-builder'),
            msf_plugin()->get_asset_version('assets/js/admin-flow.js'),
            true
        );

        msf_plugin()->enqueue_flatpickr_assets();

        wp_enqueue_style(
            'msf-form-runtime',
            MSF_PLUGIN_URL . 'assets/css/form-runtime.css',
            array(),
            msf_plugin()->get_asset_version('assets/css/form-runtime.css')
        );

        wp_enqueue_script(
            'msf-form-runtime',
            MSF_PLUGIN_URL . 'assets/js/form-runtime.js',
            array('msf-flatpickr-lv'),
            msf_plugin()->get_asset_version('assets/js/form-runtime.js'),
            true
        );

        $config = MSF_Form_Config::get($post->ID);
        $slug   = get_post_field('post_name', $post->ID);

        if ($slug === '') {
            $slug = 'msf-form-' . $post->ID;
        }

        wp_localize_script('msf-admin-builder', 'msfAdmin', array(
            'formId'        => $post->ID,
            'formTitle'     => get_the_title($post->ID),
            'formSlug'      => sanitize_file_name($slug),
            'questionTypes' => MSF_Form_Config::QUESTION_TYPES,
            'exportUrl'     => wp_nonce_url(
                admin_url('admin.php?action=msf_export_form&post=' . $post->ID),
                'msf_export_' . $post->ID
            ),
            'storedConfig'  => array(
                'schemaVersion' => $config['schemaVersion'],
                'settings'      => $config['settings'],
                'pricing'       => $config['pricing'],
            ),
            'flowLayout'    => isset($config['flowLayout']) ? $config['flowLayout'] : null,
            'previewConfig' => MSF_Form_Config::get_public($post->ID),
            'i18n'          => array(
                'flowView'       => __('Flow view', 'custom-multi-step-form'),
                'listView'       => __('List view', 'custom-multi-step-form'),
                'flowReadOnly'   => __('Drag nodes to rearrange. Connect outputs to the next step. Top output = default next; lower outputs = answer branches (radio/checkbox).', 'custom-multi-step-form'),
                'flowStart'      => __('Start', 'custom-multi-step-form'),
                'flowStartHelp'  => __('Form begins here', 'custom-multi-step-form'),
                'flowEmpty'      => __('Add steps in List view to see the flow diagram.', 'custom-multi-step-form'),
                'flowEmptyEditable' => __('Use Add question to create your first step, then connect it from Start.', 'custom-multi-step-form'),
                'flowAddQuestion' => __('Add question', 'custom-multi-step-form'),
                'flowAddSummary'  => __('Add summary', 'custom-multi-step-form'),
                'flowSelectNode'  => __('Select a step node to edit its settings.', 'custom-multi-step-form'),
                'flowDeleteNode'  => __('Delete step', 'custom-multi-step-form'),
                'flowOptional'    => __('optional', 'custom-multi-step-form'),
                'flowUntitled'    => __('Untitled step', 'custom-multi-step-form'),
                'flowBranchHelp'  => __('Connect the top output for the default next step. Connect lower outputs for each answer branch.', 'custom-multi-step-form'),
                'flowSummaryHelp' => __('Summary is the final review step before submit.', 'custom-multi-step-form'),
                'flowOutputsChanged' => __('Answer type changed. Re-open Flow view to refresh branch outputs if connections look wrong.', 'custom-multi-step-form'),
                'flowCompileError' => __('Could not compile the flow. Check connections and try again.', 'custom-multi-step-form'),
                'flowCenterNode'   => __('Center on step', 'custom-multi-step-form'),
                'flowSelectNodeCenter' => __('Select a step node first.', 'custom-multi-step-form'),
                'flowWarnings'   => __('Notes', 'custom-multi-step-form'),
                'flowShowsWhen'  => __('Shows when', 'custom-multi-step-form'),
                'flowAlways'     => __('Always shown', 'custom-multi-step-form'),
                'flowAdvancedVisibility' => __('Advanced visibility rules', 'custom-multi-step-form'),
                'dragHandle'     => __('Drag to reorder', 'custom-multi-step-form'),
                'openJsonFile'   => __('Load JSON file…', 'custom-multi-step-form'),
                'exportJson'     => __('Export JSON', 'custom-multi-step-form'),
                'importJson'     => __('JSON', 'custom-multi-step-form'),
                'importHelp'     => __('Load a file or paste JSON below, then apply it to the builder. Export downloads the current editor state (including unsaved changes). Click Update the form to save.', 'custom-multi-step-form'),
                'importIntoBuilder' => __('Apply to builder', 'custom-multi-step-form'),
                'importSuccess'  => __('Configuration imported. Review the steps and click Update to save.', 'custom-multi-step-form'),
                'importError'    => __('Invalid JSON. Expected an object with a steps array.', 'custom-multi-step-form'),
                'fileReadError'  => __('Could not read the JSON file.', 'custom-multi-step-form'),
                'fileLoaded'     => __('JSON file loaded. Review below and click Apply to builder.', 'custom-multi-step-form'),
                'previewNote'    => __('Preview only — submissions are disabled here.', 'custom-multi-step-form'),
                'step'           => __('Step', 'custom-multi-step-form'),
                'stepTitle'      => __('Step title (optional)', 'custom-multi-step-form'),
                'questionLabel'  => __('Question', 'custom-multi-step-form'),
                'questionType'   => __('Answer type', 'custom-multi-step-form'),
                'required'       => __('Required', 'custom-multi-step-form'),
                'options'        => __('Options (one per line: value|Label|+price|guest)', 'custom-multi-step-form'),
                'addStep'        => __('Add step', 'custom-multi-step-form'),
                'removeStep'     => __('Remove step', 'custom-multi-step-form'),
                'stepType'       => __('Step type', 'custom-multi-step-form'),
                'stepTypeQuestion' => __('Question', 'custom-multi-step-form'),
                'stepTypeSummary'  => __('Summary (review + submit)', 'custom-multi-step-form'),
                'visibilityMode' => __('Step visibility', 'custom-multi-step-form'),
                'visibilityAlways' => __('Always show', 'custom-multi-step-form'),
                'visibilityConditional' => __('Show when condition matches', 'custom-multi-step-form'),
                'visibilityQuestion' => __('When question ID', 'custom-multi-step-form'),
                'visibilityOperator' => __('Operator', 'custom-multi-step-form'),
                'visibilityValue' => __('Value', 'custom-multi-step-form'),
                'consentText'    => __('Consent text', 'custom-multi-step-form'),
                'consentLinkUrl' => __('Privacy policy URL', 'custom-multi-step-form'),
                'consentLinkLabel' => __('Link label', 'custom-multi-step-form'),
                'fileMaxSize'    => __('Max file size (MB)', 'custom-multi-step-form'),
                'numberMin'      => __('Minimum value', 'custom-multi-step-form'),
                'numberMax'      => __('Maximum value', 'custom-multi-step-form'),
                'numberPlaceholder' => __('Example placeholder', 'custom-multi-step-form'),
                'numberPlaceholderHelp' => __('Use a number only (e.g. 80), or check “Leave placeholder empty” below.', 'custom-multi-step-form'),
                'numberEmptyPlaceholder' => __('Leave placeholder empty', 'custom-multi-step-form'),
                'numberExamples' => __('Quick-pick values', 'custom-multi-step-form'),
                'numberExamplesHelp' => __('Comma-separated numbers for shortcut buttons, e.g. 50, 80, 100, 150', 'custom-multi-step-form'),
                'textFormat'     => __('Text validation', 'custom-multi-step-form'),
                'formatNone'     => __('None', 'custom-multi-step-form'),
                'formatEmail'    => __('Email', 'custom-multi-step-form'),
                'formatPhone'    => __('Phone', 'custom-multi-step-form'),
                'nestedGroupsNote' => __('This step has advanced nested visibility rules (preserved on save).', 'custom-multi-step-form'),
                'types'          => array(
                    'text'     => __('Text', 'custom-multi-step-form'),
                    'textarea' => __('Long text', 'custom-multi-step-form'),
                    'number'   => __('Number', 'custom-multi-step-form'),
                    'radio'    => __('Single choice (radio)', 'custom-multi-step-form'),
                    'checkbox' => __('Multiple choice (checkbox)', 'custom-multi-step-form'),
                    'email'    => __('Email', 'custom-multi-step-form'),
                    'tel'      => __('Phone', 'custom-multi-step-form'),
                    'date'     => __('Date', 'custom-multi-step-form'),
                    'file'     => __('File upload', 'custom-multi-step-form'),
                    'consent'  => __('GDPR consent checkbox', 'custom-multi-step-form'),
                ),
            ),
        ));
    }

    public function render_settings_meta_box($post) {
        wp_nonce_field('msf_save_form', 'msf_form_nonce');
        $config   = MSF_Form_Config::get($post->ID);
        $settings = $config['settings'];
        ?>
        <table class="form-table msf-form-settings-table">
            <tr>
                <th><label for="msf_owner_email"><?php esc_html_e('Owner email', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="email" class="regular-text" id="msf_owner_email" name="msf_owner_email"
                           value="<?php echo esc_attr($settings['ownerEmail']); ?>"
                           placeholder="<?php esc_attr_e('Uses site default if empty', 'custom-multi-step-form'); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_success_message"><?php esc_html_e('Success message (on page)', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <textarea class="large-text" rows="3" id="msf_success_message" name="msf_success_message"><?php echo esc_textarea($settings['successMessage']); ?></textarea>
                </td>
            </tr>
            <tr>
                <th><label for="msf_customer_subject"><?php esc_html_e('Customer email subject', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="text" class="large-text" id="msf_customer_subject" name="msf_customer_subject"
                           value="<?php echo esc_attr($settings['customerEmailSubject']); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_customer_body"><?php esc_html_e('Customer email body', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <textarea class="large-text" rows="5" id="msf_customer_body" name="msf_customer_body"><?php echo esc_textarea($settings['customerEmailBody']); ?></textarea>
                    <p class="description"><?php esc_html_e('Sent only when the form includes an email question and the visitor fills it in.', 'custom-multi-step-form'); ?></p>
                </td>
            </tr>
            <tr>
                <th><label for="msf_submit_label"><?php esc_html_e('Submit button label', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="text" class="regular-text" id="msf_submit_label" name="msf_submit_label"
                           value="<?php echo esc_attr($settings['submitLabel']); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_step_transition_ms"><?php esc_html_e('Step transition (ms)', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="number" class="small-text" id="msf_step_transition_ms" name="msf_step_transition_ms"
                           min="0" step="50" value="<?php echo esc_attr($settings['stepTransitionMs']); ?>">
                </td>
            </tr>
        </table>

        <?php $pricing = $config['pricing']; ?>
        <h3><?php esc_html_e('Pricing', 'custom-multi-step-form'); ?></h3>
        <table class="form-table msf-form-settings-table">
            <tr>
                <th><?php esc_html_e('Enable pricing', 'custom-multi-step-form'); ?></th>
                <td>
                    <label>
                        <input type="checkbox" name="msf_pricing_enabled" value="1" <?php checked(!empty($pricing['enabled'])); ?>>
                        <?php esc_html_e('Show running total and include price in owner email', 'custom-multi-step-form'); ?>
                    </label>
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_base"><?php esc_html_e('Base amount', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="number" class="small-text" id="msf_pricing_base" name="msf_pricing_base"
                           min="0" step="0.01" value="<?php echo esc_attr($pricing['baseAmount']); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_per_guest"><?php esc_html_e('Per-guest rate', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="number" class="small-text" id="msf_pricing_per_guest" name="msf_pricing_per_guest"
                           min="0" step="0.01" value="<?php echo esc_attr($pricing['perGuestRate']); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_guest_question"><?php esc_html_e('Guest count question ID', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="text" class="regular-text" id="msf_pricing_guest_question" name="msf_pricing_guest_question"
                           value="<?php echo esc_attr($pricing['perGuestQuestionId']); ?>"
                           placeholder="q_guest_count">
                    <p class="description"><?php esc_html_e('Must match the number question id in your steps.', 'custom-multi-step-form'); ?></p>
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_display"><?php esc_html_e('Price display', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <select id="msf_pricing_display" name="msf_pricing_display">
                        <option value="summary" <?php selected($pricing['displayOn'], 'summary'); ?>><?php esc_html_e('Summary step only', 'custom-multi-step-form'); ?></option>
                        <option value="sticky" <?php selected($pricing['displayOn'], 'sticky'); ?>><?php esc_html_e('Sticky bar while filling form', 'custom-multi-step-form'); ?></option>
                        <option value="both" <?php selected($pricing['displayOn'], 'both'); ?>><?php esc_html_e('Sticky bar and summary', 'custom-multi-step-form'); ?></option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="msf_pricing_currency"><?php esc_html_e('Currency', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <input type="text" class="small-text" id="msf_pricing_currency" name="msf_pricing_currency"
                           value="<?php echo esc_attr($pricing['currency']); ?>">
                </td>
            </tr>
        </table>
        <p class="description">
            <?php esc_html_e('Option price effects are set per step in the builder (value|Label|+amount|guest). See the sample form Banketu piedāvājums for a full example.', 'custom-multi-step-form'); ?>
        </p>

        <h3><?php esc_html_e('Theme / custom CSS', 'custom-multi-step-form'); ?></h3>
        <table class="form-table msf-form-settings-table">
            <tr>
                <th><label for="msf_custom_css"><?php esc_html_e('Custom CSS', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <textarea class="large-text code msf-custom-css-field" rows="10" id="msf_custom_css" name="msf_custom_css" spellcheck="false"><?php echo esc_textarea($settings['customCss']); ?></textarea>
                    <p class="description">
                        <?php esc_html_e('Optional CSS for this form only. Scope rules to', 'custom-multi-step-form'); ?>
                        <code>#msf-form-<?php echo esc_html($post->ID); ?></code>
                        <?php esc_html_e('or .msf-form. Variables: --msf-color-primary, --msf-color-text, --msf-color-text-muted, --msf-color-input-bg, --msf-color-border, --msf-radius, --msf-max-width, --msf-input-min-height.', 'custom-multi-step-form'); ?>
                    </p>
                    <p class="description">
                        <code>.msf-form { --msf-color-primary: #8b4513; --msf-max-width: 720px; }</code>
                    </p>
                </td>
            </tr>
            <tr>
                <th><label for="msf_page_css"><?php esc_html_e('Page layout CSS', 'custom-multi-step-form'); ?></label></th>
                <td>
                    <textarea class="large-text code msf-page-css-field" rows="12" id="msf_page_css" name="msf_page_css" spellcheck="false"><?php echo esc_textarea($settings['pageCss']); ?></textarea>
                    <p class="description">
                        <?php esc_html_e('Optional CSS for the page that contains this form (footer position, centering). The page body gets class', 'custom-multi-step-form'); ?>
                        <code>has-msf-form</code>
                        <?php esc_html_e('and', 'custom-multi-step-form'); ?>
                        <code>has-msf-form-<?php echo esc_html($post->ID); ?></code>.
                    </p>
                    <p class="description">
                        <?php esc_html_e('Avada starter (sticky footer, centered form):', 'custom-multi-step-form'); ?>
                    </p>
                    <pre class="msf-css-snippet" style="max-height:12em;overflow:auto;background:#f6f7f7;padding:0.75rem;border:1px solid #dcdcde;"><?php echo esc_html(MSF_Page_Layout::default_avada_page_css()); ?></pre>
                </td>
            </tr>
        </table>
        <?php
    }

    public function render_steps_meta_box($post) {
        $config = MSF_Form_Config::get($post->ID);
        ?>
        <div class="msf-builder-tabs" role="tablist" aria-label="<?php esc_attr_e('Form step builder views', 'custom-multi-step-form'); ?>">
            <button type="button" class="button msf-builder-tab is-active" data-msf-builder-view="list" role="tab" aria-selected="true">
                <?php esc_html_e('List view', 'custom-multi-step-form'); ?>
            </button>
            <button type="button" class="button msf-builder-tab" data-msf-builder-view="flow" role="tab" aria-selected="false">
                <?php esc_html_e('Flow view', 'custom-multi-step-form'); ?>
            </button>
        </div>

        <div id="msf-steps-list-view">
            <p class="description"><?php esc_html_e('Drag steps by the handle to reorder.', 'custom-multi-step-form'); ?></p>
            <div id="msf-steps-builder" class="msf-steps-builder"></div>
            <p>
                <button type="button" class="button button-secondary" id="msf-add-step">
                    <?php esc_html_e('Add step', 'custom-multi-step-form'); ?>
                </button>
            </p>
        </div>

        <div id="msf-steps-flow-view" hidden>
            <div class="msf-flow-toolbar">
                <button type="button" class="button button-secondary" id="msf-flow-add-question">
                    <?php esc_html_e('Add question', 'custom-multi-step-form'); ?>
                </button>
                <button type="button" class="button button-secondary" id="msf-flow-add-summary">
                    <?php esc_html_e('Add summary', 'custom-multi-step-form'); ?>
                </button>
                <span class="msf-flow-toolbar__spacer" aria-hidden="true"></span>
                <button type="button" class="button button-secondary" id="msf-flow-zoom-out" title="<?php esc_attr_e('Zoom out', 'custom-multi-step-form'); ?>" aria-label="<?php esc_attr_e('Zoom out', 'custom-multi-step-form'); ?>">−</button>
                <button type="button" class="button button-secondary" id="msf-flow-fit-view">
                    <?php esc_html_e('Fit to view', 'custom-multi-step-form'); ?>
                </button>
                <button type="button" class="button button-secondary" id="msf-flow-center-node">
                    <?php esc_html_e('Center on step', 'custom-multi-step-form'); ?>
                </button>
                <button type="button" class="button button-secondary" id="msf-flow-zoom-in" title="<?php esc_attr_e('Zoom in', 'custom-multi-step-form'); ?>" aria-label="<?php esc_attr_e('Zoom in', 'custom-multi-step-form'); ?>">+</button>
            </div>
            <div class="msf-flow-workspace">
                <div id="msf-flow-canvas" class="msf-flow-canvas" aria-label="<?php esc_attr_e('Form flow diagram', 'custom-multi-step-form'); ?>"></div>
                <aside id="msf-flow-inspector" class="msf-flow-inspector" aria-label="<?php esc_attr_e('Step properties', 'custom-multi-step-form'); ?>">
                    <p class="msf-flow-inspector__empty"><?php esc_html_e('Select a step node to edit its settings.', 'custom-multi-step-form'); ?></p>
                </aside>
            </div>
            <div id="msf-flow-warnings" class="msf-flow-warnings" hidden></div>
            <p class="description msf-flow-help"><?php esc_html_e('Drag nodes to rearrange. Connect outputs to the next step. Top output = default next; lower outputs = answer branches (radio/checkbox). Pan the canvas by dragging empty space, holding Space while dragging, or using the middle mouse button. Scroll to zoom, or use Fit to view.', 'custom-multi-step-form'); ?></p>
        </div>

        <input type="hidden" id="msf_steps_json" name="msf_steps_json" value="<?php echo esc_attr(wp_json_encode($config['steps'], JSON_UNESCAPED_UNICODE)); ?>">
        <input type="hidden" id="msf_flow_layout_json" name="msf_flow_layout_json" value="<?php echo esc_attr(wp_json_encode(isset($config['flowLayout']) ? $config['flowLayout'] : array('version' => 1, 'nodes' => array()), JSON_UNESCAPED_UNICODE)); ?>">
        <?php
    }

    public function render_import_export_meta_box($post) {
        ?>
        <p>
            <input type="file" id="msf-import-json-file" class="msf-import-json-file" accept=".json,application/json,text/json" hidden>
            <button type="button" class="button button-secondary" id="msf-open-json-file">
                <?php esc_html_e('Load JSON file…', 'custom-multi-step-form'); ?>
            </button>
            <button type="button" class="button button-secondary" id="msf-export-config">
                <?php esc_html_e('Export JSON', 'custom-multi-step-form'); ?>
            </button>
        </p>
        <p>
            <label for="msf-import-json"><strong><?php esc_html_e('JSON', 'custom-multi-step-form'); ?></strong></label>
        </p>
        <textarea id="msf-import-json" class="large-text code" rows="8" placeholder="<?php esc_attr_e('Paste form JSON here, or use Load JSON file…', 'custom-multi-step-form'); ?>"></textarea>
        <p class="description"><?php esc_html_e('Load a file or paste JSON above, then apply it to the builder. Export downloads the current editor state (including unsaved changes). Click Update the form to save.', 'custom-multi-step-form'); ?></p>
        <p>
            <button type="button" class="button button-primary" id="msf-import-config"><?php esc_html_e('Apply to builder', 'custom-multi-step-form'); ?></button>
        </p>
        <?php
    }

    public function render_preview_meta_box($post) {
        $public = MSF_Form_Config::get_public($post->ID);

        if (!$public || empty($public['steps'])) {
            echo '<p>' . esc_html__('Add steps to preview the form.', 'custom-multi-step-form') . '</p>';
            return;
        }

        $runtime_i18n = MSF_I18n::runtime_strings();
        $full_config  = MSF_Form_Config::get($post->ID);
        $custom_css   = $full_config ? $full_config['settings']['customCss'] : '';
        echo MSF_Form_Config::render_custom_css_tag($post->ID, $custom_css); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        ?>
        <p class="description"><?php esc_html_e('Interactive preview (submissions disabled).', 'custom-multi-step-form'); ?></p>
        <div
            id="msf-admin-preview"
            class="msf-form msf-form--preview"
            data-msf-preview="1"
            data-msf-form-id="<?php echo esc_attr($post->ID); ?>"
            data-msf-config="<?php echo esc_attr(wp_json_encode($public)); ?>"
            data-msf-i18n="<?php echo esc_attr(wp_json_encode($runtime_i18n)); ?>"
        >
            <div class="msf-form__progress" aria-hidden="true">
                <div class="msf-form__progress-bar"></div>
            </div>
            <div class="msf-form__price-bar" hidden></div>
            <div class="msf-form__body"></div>
        </div>
        <?php
    }

    public function render_entry_meta_box($post) {
        $form_id  = get_post_meta($post->ID, '_msf_entry_form_id', true);
        $answers  = get_post_meta($post->ID, '_msf_entry_answers', true);
        $pricing  = get_post_meta($post->ID, '_msf_entry_pricing', true);
        $page_url = get_post_meta($post->ID, '_msf_entry_page_url', true);

        if (!is_array($answers)) {
            $answers = array();
        }

        $form_title = $form_id ? get_the_title($form_id) : '—';
        ?>
        <p><strong><?php esc_html_e('Form:', 'custom-multi-step-form'); ?></strong> <?php echo esc_html($form_title); ?></p>
        <?php if ($page_url) : ?>
            <p><strong><?php esc_html_e('Page:', 'custom-multi-step-form'); ?></strong>
                <a href="<?php echo esc_url($page_url); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html($page_url); ?></a>
            </p>
        <?php endif; ?>
        <table class="widefat striped">
            <thead>
                <tr>
                    <th><?php esc_html_e('Question', 'custom-multi-step-form'); ?></th>
                    <th><?php esc_html_e('Answer', 'custom-multi-step-form'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($answers as $row) : ?>
                    <tr>
                        <td><?php echo esc_html(isset($row['label']) ? $row['label'] : ''); ?></td>
                        <td><?php echo esc_html(isset($row['display']) ? $row['display'] : ''); ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php if (is_array($pricing) && !empty($pricing['total'])) : ?>
            <h4><?php esc_html_e('Calculated price', 'custom-multi-step-form'); ?></h4>
            <p><strong><?php echo esc_html(MSF_Pricing::format_money($pricing['total'], isset($pricing['currency']) ? $pricing['currency'] : 'EUR')); ?></strong></p>
            <?php if (!empty($pricing['lines']) && is_array($pricing['lines'])) : ?>
                <ul>
                    <?php foreach ($pricing['lines'] as $line) : ?>
                        <li><?php echo esc_html($line['label']); ?>: <?php echo esc_html(MSF_Pricing::format_money($line['amount'], isset($pricing['currency']) ? $pricing['currency'] : 'EUR')); ?></li>
                    <?php endforeach; ?>
                </ul>
            <?php endif; ?>
        <?php endif; ?>
        <?php
    }

    public function save_form($post_id, $post) {
        if (!isset($_POST['msf_form_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['msf_form_nonce'])), 'msf_save_form')) {
            return;
        }

        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }

        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        $existing = MSF_Form_Config::get($post_id);
        if (!$existing) {
            $existing = MSF_Form_Config::default_config();
        }

        $existing['settings']['ownerEmail']           = isset($_POST['msf_owner_email']) ? sanitize_email(wp_unslash($_POST['msf_owner_email'])) : '';
        $existing['settings']['successMessage']       = isset($_POST['msf_success_message']) ? sanitize_textarea_field(wp_unslash($_POST['msf_success_message'])) : '';
        $existing['settings']['customerEmailSubject'] = isset($_POST['msf_customer_subject']) ? sanitize_text_field(wp_unslash($_POST['msf_customer_subject'])) : '';
        $existing['settings']['customerEmailBody']    = isset($_POST['msf_customer_body']) ? sanitize_textarea_field(wp_unslash($_POST['msf_customer_body'])) : '';
        $existing['settings']['submitLabel']          = isset($_POST['msf_submit_label']) ? sanitize_text_field(wp_unslash($_POST['msf_submit_label'])) : '';
        $existing['settings']['stepTransitionMs']     = isset($_POST['msf_step_transition_ms']) ? absint($_POST['msf_step_transition_ms']) : 400;
        $existing['settings']['customCss']          = isset($_POST['msf_custom_css'])
            ? MSF_Form_Config::sanitize_custom_css(wp_unslash($_POST['msf_custom_css']))
            : '';
        $existing['settings']['pageCss']            = isset($_POST['msf_page_css'])
            ? MSF_Form_Config::sanitize_custom_css(wp_unslash($_POST['msf_page_css']))
            : '';

        $existing['pricing']['enabled']            = !empty($_POST['msf_pricing_enabled']);
        $existing['pricing']['baseAmount']         = isset($_POST['msf_pricing_base']) ? floatval($_POST['msf_pricing_base']) : 0;
        $existing['pricing']['perGuestRate']       = isset($_POST['msf_pricing_per_guest']) ? floatval($_POST['msf_pricing_per_guest']) : 0;
        $existing['pricing']['perGuestQuestionId'] = isset($_POST['msf_pricing_guest_question']) ? sanitize_key(wp_unslash($_POST['msf_pricing_guest_question'])) : '';
        $existing['pricing']['displayOn']          = isset($_POST['msf_pricing_display']) ? sanitize_key(wp_unslash($_POST['msf_pricing_display'])) : 'summary';
        $existing['pricing']['currency']           = isset($_POST['msf_pricing_currency']) ? sanitize_text_field(wp_unslash($_POST['msf_pricing_currency'])) : 'EUR';

        $steps = array();

        if (isset($_POST['msf_steps_json'])) {
            $decoded = json_decode(wp_unslash($_POST['msf_steps_json']), true);

            if (is_array($decoded)) {
                $steps = $decoded;
            }
        }

        if (isset($_POST['msf_flow_layout_json'])) {
            $layout = json_decode(wp_unslash($_POST['msf_flow_layout_json']), true);

            if (is_array($layout)) {
                $existing['flowLayout'] = $layout;
            }
        }

        $existing['steps'] = $steps;

        MSF_Form_Config::save($post_id, $existing);
    }
}
