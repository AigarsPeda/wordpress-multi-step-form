(function ($) {
    'use strict';

    var $builder = $('#msf-steps-builder');
    var $hidden = $('#msf_steps_json');

    if (!$builder.length || !$hidden.length || typeof msfAdmin === 'undefined') {
        return;
    }

    var stepIndex = 0;
    var initialSteps = [];

    function parseInitial() {
        try {
            return JSON.parse($hidden.val() || '[]');
        } catch (e) {
            return [];
        }
    }

    function optionTypeChoices(selected) {
        var html = '';
        $.each(msfAdmin.i18n.types, function (value, label) {
            html += '<option value="' + value + '"' + (selected === value ? ' selected' : '') + '>' + label + '</option>';
        });
        return html;
    }

    function formatChoices(selected) {
        var formats = [
            ['', msfAdmin.i18n.formatNone || 'None'],
            ['email', msfAdmin.i18n.formatEmail || 'Email'],
            ['phone', msfAdmin.i18n.formatPhone || 'Phone']
        ];
        var html = '';

        formats.forEach(function (item) {
            html += '<option value="' + item[0] + '"' + (selected === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        });

        return html;
    }

    function optionsToText(options) {
        if (!options || !options.length) {
            return '';
        }

        return options.map(function (opt) {
            var line = opt.value + '|' + opt.label;

            if (opt.priceEffect && opt.priceEffect.add) {
                line += '|+' + opt.priceEffect.add;
                if (opt.priceEffect.perGuest) {
                    line += '|guest';
                }
            }

            return line;
        }).join('\n');
    }

    function textToOptions(text) {
        return text.split('\n').map(function (line) {
            line = line.trim();
            if (!line) {
                return null;
            }

            var parts = line.split('|').map(function (part) {
                return part.trim();
            });
            var option = {
                value: parts[0] || '',
                label: parts[1] || parts[0] || ''
            };

            if (parts[2]) {
                var match = parts[2].match(/^\+?(-?\d+(?:\.\d+)?)/);
                if (match) {
                    option.priceEffect = { add: parseFloat(match[1]) };
                    if (parts[3] === 'guest' || parts[3] === 'perGuest') {
                        option.priceEffect.perGuest = true;
                    }
                }
            }

            return option;
        }).filter(Boolean);
    }

    function buildStepCard(step, index) {
        var question = (step.questions && step.questions[0]) || {
            type: 'text',
            label: '',
            required: true,
            options: []
        };
        var stepType = step.type || 'question';
        var visibility = step.visibility || { mode: 'always' };
        var condition = (visibility.conditions && visibility.conditions[0]) || {};
        var needsOptions = question.type === 'radio' || question.type === 'checkbox';
        var optionsDisplay = needsOptions ? '' : ' style="display:none;"';
        var isSummary = stepType === 'summary';
        var isConsent = question.type === 'consent';
        var isFile = question.type === 'file';
        var isText = (question.type || 'text') === 'text';
        var textFormat = question.format || '';
        var hasNestedGroups = visibility.groups && visibility.groups.length;
        var consentDisplay = isConsent ? '' : ' style="display:none;"';
        var fileDisplay = isFile ? '' : ' style="display:none;"';
        var maxSize = (question.validation && question.validation.maxSizeMb) ? question.validation.maxSizeMb : 5;

        var html = '<div class="msf-step-card" data-index="' + index + '">';
        html += '<div class="msf-step-card__head">';
        html += '<span class="msf-step-drag-handle dashicons dashicons-move" title="' + escapeAttr(msfAdmin.i18n.dragHandle || 'Drag to reorder') + '" aria-hidden="true"></span>';
        html += '<strong>' + msfAdmin.i18n.step + ' <span class="msf-step-num">' + (index + 1) + '</span></strong>';
        html += '<button type="button" class="button-link-delete msf-remove-step">' + msfAdmin.i18n.removeStep + '</button>';
        html += '</div>';
        html += '<p><label>' + msfAdmin.i18n.stepType + '<br><select class="msf-step-type">';
        html += '<option value="question"' + (stepType === 'question' ? ' selected' : '') + '>' + msfAdmin.i18n.stepTypeQuestion + '</option>';
        html += '<option value="summary"' + (stepType === 'summary' ? ' selected' : '') + '>' + msfAdmin.i18n.stepTypeSummary + '</option>';
        html += '</select></label></p>';
        html += '<p><label>' + msfAdmin.i18n.stepTitle + '<br><input type="text" class="widefat msf-step-title" value="' + escapeAttr(step.title || '') + '"></label></p>';
        html += '<div class="msf-step-question-fields"' + (isSummary ? ' style="display:none;"' : '') + '>';
        html += '<p><label>' + msfAdmin.i18n.questionLabel + '<br><input type="text" class="widefat msf-question-label" value="' + escapeAttr(question.label || '') + '"></label></p>';
        html += '<p><label>' + msfAdmin.i18n.questionType + '<br><select class="msf-question-type">' + optionTypeChoices(question.type || 'text') + '</select></label></p>';
        html += '<p class="msf-format-wrap"' + (isText ? '' : ' style="display:none;"') + '><label>' + msfAdmin.i18n.textFormat + '<br><select class="msf-question-format">' + formatChoices(textFormat) + '</select></label></p>';
        html += '<p><label><input type="checkbox" class="msf-question-required"' + (question.required ? ' checked' : '') + '> ' + msfAdmin.i18n.required + '</label></p>';
        html += '<p class="msf-options-wrap"' + optionsDisplay + '><label>' + msfAdmin.i18n.options + '<br><textarea class="widefat msf-question-options" rows="4">' + escapeText(optionsToText(question.options)) + '</textarea></label></p>';
        html += '<div class="msf-consent-wrap"' + consentDisplay + '>';
        html += '<p><label>' + msfAdmin.i18n.consentText + '<br><input type="text" class="widefat msf-consent-text" value="' + escapeAttr(question.consentText || question.label || '') + '"></label></p>';
        html += '<p><label>' + msfAdmin.i18n.consentLinkUrl + '<br><input type="url" class="widefat msf-consent-link-url" value="' + escapeAttr(question.consentLinkUrl || '') + '"></label></p>';
        html += '<p><label>' + msfAdmin.i18n.consentLinkLabel + '<br><input type="text" class="regular-text msf-consent-link-label" value="' + escapeAttr(question.consentLinkLabel || '') + '"></label></p>';
        html += '</div>';
        html += '<p class="msf-file-wrap"' + fileDisplay + '><label>' + msfAdmin.i18n.fileMaxSize + '<br><input type="number" class="small-text msf-file-max-size" min="0.1" max="20" step="0.1" value="' + escapeAttr(maxSize) + '"></label></p>';
        html += '</div>';
        html += '<div class="msf-step-visibility">';
        html += '<p><label>' + msfAdmin.i18n.visibilityMode + '<br><select class="msf-visibility-mode">';
        html += '<option value="always"' + (visibility.mode === 'always' ? ' selected' : '') + '>' + msfAdmin.i18n.visibilityAlways + '</option>';
        html += '<option value="conditional"' + (visibility.mode === 'conditional' ? ' selected' : '') + '>' + msfAdmin.i18n.visibilityConditional + '</option>';
        html += '</select></label></p>';
        html += '<div class="msf-visibility-conditions"' + (visibility.mode === 'conditional' ? '' : ' style="display:none;"') + '>';
        html += '<p><label>' + msfAdmin.i18n.visibilityQuestion + '<br><input type="text" class="regular-text msf-visibility-question" value="' + escapeAttr(condition.questionId || '') + '" placeholder="q_event_type"></label></p>';
        html += '<p><label>' + msfAdmin.i18n.visibilityOperator + '<br><select class="msf-visibility-operator">';
        html += '<option value="equals"' + ((condition.operator || 'equals') === 'equals' ? ' selected' : '') + '>equals</option>';
        html += '<option value="notEquals"' + (condition.operator === 'notEquals' ? ' selected' : '') + '>notEquals</option>';
        html += '</select></label></p>';
        html += '<p><label>' + msfAdmin.i18n.visibilityValue + '<br><input type="text" class="regular-text msf-visibility-value" value="' + escapeAttr(condition.value || '') + '"></label></p>';
        if (hasNestedGroups) {
            html += '<p class="description">' + msfAdmin.i18n.nestedGroupsNote + '</p>';
        }
        html += '</div></div>';
        html += '</div>';

        return html;
    }

    function escapeAttr(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function escapeText(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;');
    }

    function initSortable() {
        if (!$builder.hasClass('ui-sortable')) {
            $builder.sortable({
                handle: '.msf-step-drag-handle',
                axis: 'y',
                update: function () {
                    initialSteps = collectSteps();
                    renumber();
                    syncHidden();
                    refreshAdminPreview(collectSteps());
                }
            });
        }
    }

    function refreshAdminPreview(steps) {
        var preview = document.getElementById('msf-admin-preview');

        if (!preview || typeof window.msfInitForm !== 'function') {
            return;
        }

        var config = Object.assign({}, msfAdmin.previewConfig || {}, { steps: steps });
        preview.setAttribute('data-msf-config', JSON.stringify(config));
        preview.removeAttribute('data-msf-initialized');

        var body = preview.querySelector('.msf-form__body');
        if (body) {
            body.innerHTML = '';
        }

        window.msfInitForm(preview);
    }

    function applyImportedConfig(config) {
        if (!config || !Array.isArray(config.steps)) {
            throw new Error('invalid');
        }

        if (config.settings) {
            $('#msf_owner_email').val(config.settings.ownerEmail || '');
            $('#msf_success_message').val(config.settings.successMessage || '');
            $('#msf_customer_subject').val(config.settings.customerEmailSubject || '');
            $('#msf_customer_body').val(config.settings.customerEmailBody || '');
            $('#msf_submit_label').val(config.settings.submitLabel || '');
            $('#msf_step_transition_ms').val(config.settings.stepTransitionMs || 400);
            $('#msf_custom_css').val(config.settings.customCss || '');
            $('#msf_page_css').val(config.settings.pageCss || '');
        }

        if (config.pricing) {
            $('input[name="msf_pricing_enabled"]').prop('checked', !!config.pricing.enabled);
            $('#msf_pricing_base').val(config.pricing.baseAmount || 0);
            $('#msf_pricing_per_guest').val(config.pricing.perGuestRate || 0);
            $('#msf_pricing_guest_question').val(config.pricing.perGuestQuestionId || '');
            $('#msf_pricing_display').val(config.pricing.displayOn || 'summary');
            $('#msf_pricing_currency').val(config.pricing.currency || 'EUR');
        }

        msfAdmin.previewConfig = Object.assign({}, msfAdmin.previewConfig || {}, {
            settings: (config.settings || (msfAdmin.previewConfig && msfAdmin.previewConfig.settings)),
            pricing: (config.pricing || (msfAdmin.previewConfig && msfAdmin.previewConfig.pricing)),
            steps: config.steps
        });

        render(config.steps);
        refreshAdminPreview(config.steps);
    }

    function render(steps) {
        initialSteps = steps.slice();
        $builder.empty();
        stepIndex = 0;

        if (!steps.length) {
            addStep();
            initSortable();
            return;
        }

        steps.forEach(function (step, index) {
            $builder.append(buildStepCard(step, index));
            stepIndex = index + 1;
        });

        syncHidden();
        initSortable();
    }

    function addStep() {
        $builder.append(buildStepCard({ questions: [{ type: 'text', label: '', required: true, options: [] }] }, stepIndex));
        stepIndex += 1;
        renumber();
        syncHidden();
    }

    function renumber() {
        $builder.find('.msf-step-card').each(function (i) {
            $(this).attr('data-index', i);
            $(this).find('.msf-step-num').text(i + 1);
        });
        stepIndex = $builder.find('.msf-step-card').length;
    }

    function collectSteps() {
        var steps = [];

        $builder.find('.msf-step-card').each(function (i) {
            var $card = $(this);
            var prev = initialSteps[i] || {};
            var stepType = $card.find('.msf-step-type').val() || 'question';
            var visibilityMode = $card.find('.msf-visibility-mode').val() || 'always';
            var step = {
                id: prev.id || ('step_' + (i + 1)),
                type: stepType,
                title: $card.find('.msf-step-title').val(),
                description: prev.description || '',
                visibility: {
                    mode: visibilityMode,
                    logic: (prev.visibility && prev.visibility.logic) ? prev.visibility.logic : 'and',
                    conditions: []
                },
                questions: []
            };

            if (prev.interval) {
                step.interval = prev.interval;
            }

            if (visibilityMode === 'conditional') {
                step.visibility.conditions.push({
                    questionId: $card.find('.msf-visibility-question').val(),
                    operator: $card.find('.msf-visibility-operator').val() || 'equals',
                    value: $card.find('.msf-visibility-value').val()
                });

                if (prev.visibility && prev.visibility.groups) {
                    step.visibility.groups = prev.visibility.groups;
                }
            }

            if (stepType === 'summary') {
                steps.push(step);
                return;
            }

            var type = $card.find('.msf-question-type').val();
            var question = {
                id: (prev.questions && prev.questions[0] && prev.questions[0].id) || ('q_' + (i + 1)),
                type: type,
                label: $card.find('.msf-question-label').val(),
                required: $card.find('.msf-question-required').is(':checked'),
                options: []
            };

            if (type === 'radio' || type === 'checkbox') {
                question.options = textToOptions($card.find('.msf-question-options').val());
            }

            if (type === 'consent') {
                question.consentText = $card.find('.msf-consent-text').val();
                question.consentLinkUrl = $card.find('.msf-consent-link-url').val();
                question.consentLinkLabel = $card.find('.msf-consent-link-label').val();
            }

            if (type === 'file') {
                question.validation = {
                    maxSizeMb: parseFloat($card.find('.msf-file-max-size').val()) || 5
                };
            }

            if (type === 'text') {
                var format = $card.find('.msf-question-format').val();

                if (format === 'email' || format === 'phone') {
                    question.format = format;
                }
            }

            step.questions = [question];
            steps.push(step);
        });

        return steps;
    }

    function syncHidden() {
        $hidden.val(JSON.stringify(collectSteps()));
    }

    function collectSettings() {
        var stored = (msfAdmin.storedConfig && msfAdmin.storedConfig.settings) || {};

        return Object.assign({}, stored, {
            ownerEmail: $('#msf_owner_email').val() || '',
            successMessage: $('#msf_success_message').val() || '',
            customerEmailSubject: $('#msf_customer_subject').val() || '',
            customerEmailBody: $('#msf_customer_body').val() || '',
            submitLabel: $('#msf_submit_label').val() || '',
            stepTransitionMs: parseInt($('#msf_step_transition_ms').val(), 10) || 400,
            customCss: $('#msf_custom_css').val() || '',
            pageCss: $('#msf_page_css').val() || ''
        });
    }

    function collectPricing() {
        var stored = (msfAdmin.storedConfig && msfAdmin.storedConfig.pricing) || {};

        return Object.assign({}, stored, {
            enabled: $('input[name="msf_pricing_enabled"]').is(':checked'),
            baseAmount: parseFloat($('#msf_pricing_base').val()) || 0,
            perGuestRate: parseFloat($('#msf_pricing_per_guest').val()) || 0,
            perGuestQuestionId: $('#msf_pricing_guest_question').val() || '',
            displayOn: $('#msf_pricing_display').val() || 'summary',
            currency: $('#msf_pricing_currency').val() || 'EUR'
        });
    }

    function collectExportConfig() {
        syncHidden();

        var titleInput = document.getElementById('title');
        var formTitle = titleInput && titleInput.value ? String(titleInput.value).trim() : (msfAdmin.formTitle || '');

        return {
            exportedAt: new Date().toISOString(),
            formTitle: formTitle,
            schemaVersion: (msfAdmin.storedConfig && msfAdmin.storedConfig.schemaVersion) || 3,
            settings: collectSettings(),
            pricing: collectPricing(),
            steps: collectSteps()
        };
    }

    function downloadExportConfig() {
        var exportData = collectExportConfig();
        var json = JSON.stringify(exportData, null, 2);
        var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        var filename = (msfAdmin.formSlug || ('msf-form-' + msfAdmin.formId)) + '.json';
        var link = document.createElement('a');
        var url = URL.createObjectURL(blob);

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    $builder.on('input change', 'input, select, textarea', function () {
        var $card = $(this).closest('.msf-step-card');

        if ($(this).hasClass('msf-question-type')) {
            var type = $(this).val();
            $card.find('.msf-options-wrap').toggle(type === 'radio' || type === 'checkbox');
            $card.find('.msf-consent-wrap').toggle(type === 'consent');
            $card.find('.msf-file-wrap').toggle(type === 'file');
            $card.find('.msf-format-wrap').toggle(type === 'text');
        }

        if ($(this).hasClass('msf-step-type')) {
            var isSummary = $(this).val() === 'summary';
            $card.find('.msf-step-question-fields').toggle(!isSummary);
        }

        if ($(this).hasClass('msf-visibility-mode')) {
            $card.find('.msf-visibility-conditions').toggle($(this).val() === 'conditional');
        }

        syncHidden();
    });

    $builder.on('click', '.msf-remove-step', function (e) {
        e.preventDefault();

        if ($builder.find('.msf-step-card').length <= 1) {
            return;
        }

        $(this).closest('.msf-step-card').remove();
        renumber();
        syncHidden();
    });

    $('#msf-add-step').on('click', function (e) {
        e.preventDefault();
        addStep();
    });

    $('#msf-open-json-file').on('click', function (e) {
        e.preventDefault();
        $('#msf-import-json-file').trigger('click');
    });

    $('#msf-export-config').on('click', function (e) {
        e.preventDefault();
        downloadExportConfig();
    });

    $('#msf-import-json-file').on('change', function () {
        var file = this.files && this.files[0];

        if (!file) {
            return;
        }

        var reader = new FileReader();

        reader.onload = function (event) {
            var raw = event.target && event.target.result ? String(event.target.result) : '';

            try {
                JSON.parse(raw);
                $('#msf-import-json').val(raw);
                window.alert(msfAdmin.i18n.fileLoaded || 'JSON file loaded. Review below and click Apply to builder.');
            } catch (err) {
                window.alert(msfAdmin.i18n.importError || 'Invalid JSON.');
            }
        };

        reader.onerror = function () {
            window.alert(msfAdmin.i18n.fileReadError || 'Could not read the JSON file.');
        };

        reader.readAsText(file);
        $(this).val('');
    });

    $('#msf-import-config').on('click', function (e) {
        e.preventDefault();
        var raw = $('#msf-import-json').val();

        if (!String(raw || '').trim()) {
            window.alert(msfAdmin.i18n.importError || 'Invalid JSON.');
            return;
        }

        try {
            applyImportedConfig(JSON.parse(raw));

            if (typeof window.msfFlowRender === 'function' && !$('#msf-steps-flow-view').prop('hidden')) {
                window.msfFlowRender();
            }

            window.alert(msfAdmin.i18n.importSuccess || 'Configuration imported.');
        } catch (err) {
            window.alert(msfAdmin.i18n.importError || 'Invalid JSON.');
        }
    });

    $('form#post').on('submit', function () {
        syncHidden();
    });

    window.msfBuilderSync = syncHidden;

    render(parseInitial());

    if (document.getElementById('msf-admin-preview') && typeof window.msfInitForm === 'function') {
        window.msfInitForm(document.getElementById('msf-admin-preview'));
    }
})(jQuery);
