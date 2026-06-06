(function ($) {
    'use strict';

    var $builder = $('#msf-steps-builder');
    var $hidden = $('#msf_steps_json');

    if (!$builder.length || !$hidden.length || typeof msfAdmin === 'undefined') {
        return;
    }

    var stepIndex = 0;

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

    function optionsToText(options) {
        if (!options || !options.length) {
            return '';
        }

        return options.map(function (opt) {
            return opt.value + '|' + opt.label;
        }).join('\n');
    }

    function textToOptions(text) {
        return text.split('\n').map(function (line) {
            line = line.trim();
            if (!line) {
                return null;
            }
            var parts = line.split('|');
            return {
                value: (parts[0] || '').trim(),
                label: (parts[1] || parts[0] || '').trim()
            };
        }).filter(Boolean);
    }

    function buildStepCard(step, index) {
        var question = (step.questions && step.questions[0]) || {
            type: 'text',
            label: '',
            required: true,
            options: []
        };

        var needsOptions = question.type === 'radio' || question.type === 'checkbox';
        var optionsDisplay = needsOptions ? '' : ' style="display:none;"';

        var html = '<div class="msf-step-card" data-index="' + index + '">';
        html += '<div class="msf-step-card__head">';
        html += '<strong>' + msfAdmin.i18n.step + ' <span class="msf-step-num">' + (index + 1) + '</span></strong>';
        html += '<button type="button" class="button-link-delete msf-remove-step">' + msfAdmin.i18n.removeStep + '</button>';
        html += '</div>';
        html += '<p><label>' + msfAdmin.i18n.stepTitle + '<br><input type="text" class="widefat msf-step-title" value="' + escapeAttr(step.title || '') + '"></label></p>';
        html += '<p><label>' + msfAdmin.i18n.questionLabel + '<br><input type="text" class="widefat msf-question-label" value="' + escapeAttr(question.label || '') + '" required></label></p>';
        html += '<p><label>' + msfAdmin.i18n.questionType + '<br><select class="msf-question-type">' + optionTypeChoices(question.type || 'text') + '</select></label></p>';
        html += '<p><label><input type="checkbox" class="msf-question-required"' + (question.required ? ' checked' : '') + '> ' + msfAdmin.i18n.required + '</label></p>';
        html += '<p class="msf-options-wrap"' + optionsDisplay + '><label>' + msfAdmin.i18n.options + '<br><textarea class="widefat msf-question-options" rows="4">' + escapeText(optionsToText(question.options)) + '</textarea></label></p>';
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

    function render(steps) {
        $builder.empty();
        stepIndex = 0;

        if (!steps.length) {
            addStep();
            return;
        }

        steps.forEach(function (step, index) {
            $builder.append(buildStepCard(step, index));
            stepIndex = index + 1;
        });

        syncHidden();
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
            var type = $card.find('.msf-question-type').val();
            var question = {
                id: 'q_' + (i + 1),
                type: type,
                label: $card.find('.msf-question-label').val(),
                required: $card.find('.msf-question-required').is(':checked'),
                options: []
            };

            if (type === 'radio' || type === 'checkbox') {
                question.options = textToOptions($card.find('.msf-question-options').val());
            }

            steps.push({
                id: 'step_' + (i + 1),
                title: $card.find('.msf-step-title').val(),
                description: '',
                questions: [question]
            });
        });

        return steps;
    }

    function syncHidden() {
        $hidden.val(JSON.stringify(collectSteps()));
    }

    $builder.on('input change', 'input, select, textarea', function () {
        var $card = $(this).closest('.msf-step-card');

        if ($(this).hasClass('msf-question-type')) {
            var needsOptions = $(this).val() === 'radio' || $(this).val() === 'checkbox';
            $card.find('.msf-options-wrap').toggle(needsOptions);
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

    $('form#post').on('submit', function () {
        syncHidden();
    });

    render(parseInitial());
})(jQuery);
