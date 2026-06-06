(function () {
    'use strict';

    function parseJson(value, fallback) {
        if (!value) {
            return fallback;
        }

        try {
            return JSON.parse(value);
        } catch (e) {
            return fallback;
        }
    }

    function el(tag, attrs, children) {
        var node = document.createElement(tag);

        if (attrs) {
            Object.keys(attrs).forEach(function (key) {
                if (key === 'className') {
                    node.className = attrs[key];
                } else if (key === 'text') {
                    node.textContent = attrs[key];
                } else if (key === 'html') {
                    node.innerHTML = attrs[key];
                } else {
                    node.setAttribute(key, attrs[key]);
                }
            });
        }

        (children || []).forEach(function (child) {
            if (typeof child === 'string') {
                node.appendChild(document.createTextNode(child));
            } else if (child) {
                node.appendChild(child);
            }
        });

        return node;
    }

    function getPayloadMessage(payload, fallback) {
        fallback = fallback || 'Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.';

        if (!payload || !payload.data) {
            return fallback;
        }

        if (typeof payload.data === 'string') {
            return payload.data;
        }

        if (payload.data.message) {
            return payload.data.message;
        }

        return fallback;
    }

    function evaluateCondition(condition, answers) {
        if (!condition) {
            return true;
        }

        var questionId = condition.questionId || '';
        var operator = condition.operator || 'equals';
        var expected = condition.value;
        var actual = questionId && answers[questionId] !== undefined ? answers[questionId] : null;

        switch (operator) {
            case 'notEquals':
                return String(actual) !== String(expected);
            case 'greaterThan':
                return parseFloat(actual) > parseFloat(expected);
            case 'lessThan':
                return parseFloat(actual) < parseFloat(expected);
            case 'greaterOrEqual':
                return parseFloat(actual) >= parseFloat(expected);
            case 'lessOrEqual':
                return parseFloat(actual) <= parseFloat(expected);
            case 'contains':
                if (Array.isArray(actual)) {
                    return actual.indexOf(expected) !== -1;
                }
                return String(actual).indexOf(String(expected)) !== -1;
            case 'notContains':
                if (Array.isArray(actual)) {
                    return actual.indexOf(expected) === -1;
                }
                return String(actual).indexOf(String(expected)) === -1;
            case 'isEmpty':
                return actual === null || actual === '' || (Array.isArray(actual) && !actual.length);
            case 'isNotEmpty':
                return !(actual === null || actual === '' || (Array.isArray(actual) && !actual.length));
            case 'in':
                var list = Array.isArray(expected) ? expected : String(expected).split(',').map(function (item) { return item.trim(); });
                if (Array.isArray(actual)) {
                    return actual.some(function (item) { return list.indexOf(String(item)) !== -1; });
                }
                return list.indexOf(String(actual)) !== -1;
            case 'notIn':
                var notList = Array.isArray(expected) ? expected : String(expected).split(',').map(function (item) { return item.trim(); });
                if (Array.isArray(actual)) {
                    return !actual.some(function (item) { return notList.indexOf(String(item)) !== -1; });
                }
                return notList.indexOf(String(actual)) === -1;
            case 'equals':
            default:
                if (Array.isArray(actual)) {
                    return actual.indexOf(expected) !== -1;
                }
                return String(actual) === String(expected);
        }
    }

    function evaluateGroup(group, answers) {
        var logic = group.logic === 'or' ? 'or' : 'and';
        var conditions = group.conditions || [];
        var groups = group.groups || [];
        var results = [];

        conditions.forEach(function (condition) {
            results.push(evaluateCondition(condition, answers));
        });

        groups.forEach(function (nestedGroup) {
            results.push(evaluateGroup(nestedGroup, answers));
        });

        if (!results.length) {
            return true;
        }

        if (logic === 'or') {
            return results.some(function (result) {
                return result;
            });
        }

        return results.every(function (result) {
            return result;
        });
    }

    function isVisible(visibility, answers) {
        visibility = visibility || { mode: 'always' };

        if (visibility.mode === 'never') {
            return false;
        }

        if (visibility.mode !== 'conditional') {
            return true;
        }

        return evaluateGroup(visibility, answers);
    }

    function getGuestCount(pricing, answers) {
        var questionId = pricing.perGuestQuestionId || '';

        if (questionId && answers[questionId] !== undefined && answers[questionId] !== '') {
            return Math.max(0, parseFloat(answers[questionId]) || 0);
        }

        return 0;
    }

    function formatMoney(amount, currency) {
        var formatted = Number(amount).toFixed(2).replace('.', ',');

        if (currency === 'EUR') {
            return formatted + ' €';
        }

        return formatted + ' ' + currency;
    }

    function hasGuestCountAnswer(pricing, answers) {
        var guestQuestionId = pricing.perGuestQuestionId || '';

        if (!guestQuestionId) {
            return true;
        }

        if (answers[guestQuestionId] === undefined || answers[guestQuestionId] === null || answers[guestQuestionId] === '') {
            return false;
        }

        return true;
    }

    function calculatePricing(config, answers, options) {
        options = options || {};
        var pricing = config.pricing || {};

        if (!pricing.enabled) {
            return { total: 0, lines: [], currency: pricing.currency || 'EUR' };
        }

        var currency = pricing.currency || 'EUR';

        if (options.estimated && !hasGuestCountAnswer(pricing, answers)) {
            return { total: 0, lines: [], currency: currency };
        }

        var total = parseFloat(pricing.baseAmount) || 0;
        var lines = [];
        var guestCount = getGuestCount(pricing, answers);
        var perGuestRate = parseFloat(pricing.perGuestRate) || 0;

        if (total > 0) {
            lines.push({ label: 'Bāzes maksa', amount: total });
        }

        if (perGuestRate > 0 && guestCount > 0) {
            var guestAmount = perGuestRate * guestCount;
            total += guestAmount;
            lines.push({
                label: 'Ēdiens (' + guestCount + ' viesi × ' + formatMoney(perGuestRate, currency) + ')',
                amount: guestAmount
            });
        }

        getVisibleSteps(config.steps, answers).forEach(function (step) {
            if (!step.questions || !step.questions[0] || step.type === 'summary') {
                return;
            }

            var question = step.questions[0];
            var answer = answers[question.id];

            if (answer === null || answer === undefined || answer === '') {
                return;
            }

            if (question.type !== 'radio' && question.type !== 'checkbox') {
                return;
            }

            var selected = Array.isArray(answer) ? answer : [answer];

            (question.options || []).forEach(function (option) {
                if (selected.indexOf(option.value) === -1 || !option.priceEffect) {
                    return;
                }

                var amount = parseFloat(option.priceEffect.add) || 0;

                if (option.priceEffect.perGuest) {
                    amount *= Math.max(1, guestCount);
                }

                if (amount <= 0) {
                    return;
                }

                total += amount;
                lines.push({ label: option.label, amount: amount });
            });
        });

        return {
            total: Math.round(total * 100) / 100,
            lines: lines,
            currency: currency
        };
    }

    function getVisibleSteps(steps, answers) {
        return (steps || []).filter(function (step) {
            return isVisible(step.visibility, answers);
        });
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    }

    function isValidPhone(value) {
        var trimmed = String(value || '').trim();

        if (!trimmed || !/^[0-9+\s().\-]+$/.test(trimmed)) {
            return false;
        }

        var digits = trimmed.replace(/\D+/g, '');
        return digits.length >= 8 && digits.length <= 15;
    }

    function isValidIsoDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) {
            return false;
        }

        var parts = String(value).split('-');
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10);
        var day = parseInt(parts[2], 10);
        var date = new Date(year, month - 1, day);

        return date.getFullYear() === year
            && date.getMonth() === month - 1
            && date.getDate() === day;
    }

    function getContactFormat(question) {
        if (!question) {
            return null;
        }

        if (question.type === 'email') {
            return 'email';
        }

        if (question.type === 'tel') {
            return 'phone';
        }

        if (question.type === 'text' && (question.format === 'email' || question.format === 'phone')) {
            return question.format;
        }

        return null;
    }

    function MSForm(root) {
        this.root = root;
        this.config = parseJson(root.getAttribute('data-msf-config'), null);
        this.successMessage = root.getAttribute('data-msf-success') || '';
        this.pageUrl = root.getAttribute('data-msf-page-url') || window.location.href;
        this.formId = parseInt(root.getAttribute('data-msf-form-id'), 10) || 0;
        this.ajaxUrl = root.getAttribute('data-msf-ajax-url')
            || (window.msfRuntime && window.msfRuntime.ajaxUrl)
            || '/wp-admin/admin-ajax.php';
        this.nonce = root.getAttribute('data-msf-nonce')
            || (window.msfRuntime && window.msfRuntime.nonce)
            || '';
        this.body = root.querySelector('.msf-form__body');
        this.progressWrap = root.querySelector('.msf-form__progress');
        this.progressBar = root.querySelector('.msf-form__progress-bar');
        this.priceBar = root.querySelector('.msf-form__price-bar');
        this.hp = root.querySelector('input[name="msf_hp"]');
        this.currentStepId = null;
        this.history = [];
        this.answers = {};
        this.fileAnswers = {};
        this.datePickers = [];
        this.isSubmitting = false;
        this.isPreview = root.getAttribute('data-msf-preview') === '1';
        this.i18n = parseJson(root.getAttribute('data-msf-i18n'), null)
            || (window.msfRuntime && window.msfRuntime.i18n)
            || {
                required: 'Šis lauks ir obligāts.',
                submitting: 'Nosūta…',
                error: 'Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.',
                estimatedPrice: 'Aptuvenā cena',
                summaryTitle: 'Kopsavilkums',
                yourAnswers: 'Jūsu atbildes',
                total: 'Kopā',
                consentAccepted: 'Piekrīts',
                fileHint: 'Maks. %s MB (JPG, PNG, PDF, DOC)',
                previewSubmit: 'Priekšskatījums — saglabājiet formu un skatiet lapā, lai nosūtītu.',
                loading: 'Ielādē formu…',
                datePlaceholder: 'dd/mm/yyyy',
                dateAfterWeek: 'Pēc nedēļas',
                dateAfterMonth: 'Pēc mēneša',
                dateAfterThreeMonths: 'Pēc 3 mēnešiem',
                invalidEmail: 'Lūdzu, ievadiet derīgu e-pasta adresi.',
                invalidPhone: 'Lūdzu, ievadiet derīgu tālruņa numuru.',
                invalidDate: 'Lūdzu, ievadiet derīgu datumu.',
                progressLabel: 'Formas progress'
            };
    }

    MSForm.prototype.fieldInputId = function (questionId, suffix) {
        var id = 'msf-field-' + this.formId + '-' + questionId;

        return suffix ? id + '-' + suffix : id;
    };

    MSForm.prototype.fieldErrorId = function (questionId) {
        return 'msf-error-' + this.formId + '-' + questionId;
    };

    MSForm.prototype.getQuestionControl = function (question) {
        if (!question || !this.body) {
            return null;
        }

        if (question.type === 'checkbox') {
            return this.body.querySelector('[name="' + question.id + '[]"]');
        }

        return this.body.querySelector('[name="' + question.id + '"]')
            || document.getElementById(this.fieldInputId(question.id));
    };

    MSForm.prototype.clearFieldErrors = function () {
        if (!this.body) {
            return;
        }

        this.body.querySelectorAll('.msf-form__error').forEach(function (node) {
            node.remove();
        });

        this.body.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
            field.removeAttribute('aria-invalid');
            field.removeAttribute('aria-describedby');
        });
    };

    MSForm.prototype.getTransitionMs = function () {
        var settings = this.config.settings || {};
        return parseInt(settings.stepTransitionMs, 10) || 400;
    };

    MSForm.prototype.getVisibleSteps = function () {
        return getVisibleSteps(this.config.steps, this.answers);
    };

    MSForm.prototype.getCurrentStep = function () {
        var steps = this.getVisibleSteps();
        var self = this;

        if (this.currentStepId) {
            var found = steps.find(function (step) { return step.id === self.currentStepId; });
            if (found) {
                return found;
            }
        }

        return steps[0] || null;
    };

    MSForm.prototype.init = function () {
        if (!this.config || !this.config.steps || !this.config.steps.length) {
            this.body.innerHTML = '';
            return;
        }

        var first = this.getVisibleSteps()[0];

        if (!first) {
            this.body.innerHTML = '';
            return;
        }

        this.currentStepId = first.id;
        this.renderStep();
    };

    MSForm.prototype.updateProgress = function () {
        if (!this.progressBar || !this.progressWrap) {
            return;
        }

        var settings = this.config.settings || {};
        var steps = this.getVisibleSteps();

        if (!settings.showProgressBar) {
            this.progressWrap.style.display = 'none';
            return;
        }

        this.progressWrap.style.display = '';
        var index = steps.findIndex(function (step) { return step.id === this.currentStepId; }.bind(this));
        var percent = steps.length ? ((index + 1) / steps.length) * 100 : 0;
        this.progressBar.style.width = percent + '%';
        this.progressWrap.setAttribute('role', 'progressbar');
        this.progressWrap.setAttribute('aria-valuemin', '0');
        this.progressWrap.setAttribute('aria-valuemax', '100');
        this.progressWrap.setAttribute('aria-valuenow', String(Math.round(percent)));
        this.progressWrap.setAttribute('aria-label', this.i18n.progressLabel || 'Formas progress');
    };

    MSForm.prototype.updatePriceBar = function () {
        if (!this.priceBar) {
            return;
        }

        var pricing = this.config.pricing || {};
        var displayOn = pricing.displayOn || 'summary';

        if (!pricing.enabled || displayOn === 'summary' || displayOn === 'none') {
            this.priceBar.hidden = true;
            return;
        }

        if (displayOn !== 'sticky' && displayOn !== 'both') {
            this.priceBar.hidden = true;
            return;
        }

        var result = calculatePricing(this.config, this.getAnswersForPricing(), { estimated: true });
        this.priceBar.hidden = false;
        this.priceBar.innerHTML = '<span class="msf-form__price-label">' + (this.i18n.estimatedPrice || 'Aptuvenā cena') + '</span>'
            + '<span class="msf-form__price-value">' + formatMoney(result.total, result.currency) + '</span>';
    };

    MSForm.prototype.readQuestionValue = function (question) {
        if (!question || !this.body) {
            return null;
        }

        if (question.type === 'checkbox') {
            return Array.prototype.map.call(
                this.body.querySelectorAll('[name="' + question.id + '[]"]:checked'),
                function (input) { return input.value; }
            );
        }

        if (question.type === 'radio') {
            var checked = this.body.querySelector('[name="' + question.id + '"]:checked');
            return checked ? checked.value : '';
        }

        if (question.type === 'consent') {
            var consentInput = this.body.querySelector('[name="' + question.id + '"]');
            return consentInput && consentInput.checked ? '1' : '';
        }

        if (question.type === 'file') {
            var fileInput = this.body.querySelector('[name="' + question.id + '"]');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                return fileInput.files[0].name;
            }
            return this.fileAnswers[question.id] ? this.fileAnswers[question.id].name : '';
        }

        var field = this.body.querySelector('[name="' + question.id + '"]');
        return field ? field.value : '';
    };

    MSForm.prototype.getAnswersForPricing = function () {
        var answers = Object.assign({}, this.answers);
        var step = this.getCurrentStep();

        if (!step || step.type === 'summary' || !step.questions || !step.questions[0]) {
            return answers;
        }

        var question = step.questions[0];
        var currentValue = this.readQuestionValue(question);

        if (currentValue !== null && currentValue !== '') {
            answers[question.id] = currentValue;
        }

        return answers;
    };

    MSForm.prototype.renderPriceBreakdown = function (result) {
        var wrap = el('div', { className: 'msf-form__price-breakdown' });
        var list = el('ul', { className: 'msf-form__price-lines' });

        (result.lines || []).forEach(function (line) {
            list.appendChild(el('li', {
                className: 'msf-form__price-line',
                html: '<span>' + line.label + '</span><span>' + formatMoney(line.amount, result.currency) + '</span>'
            }));
        });

        wrap.appendChild(list);
        wrap.appendChild(el('p', {
            className: 'msf-form__price-total',
            html: '<strong>' + (this.i18n.total || 'Kopā') + ':</strong> ' + formatMoney(result.total, result.currency)
        }));

        return wrap;
    };

    MSForm.prototype.getAnswerDisplay = function (question, value) {
        if (question.type === 'checkbox' && Array.isArray(value)) {
            return value.map(function (selected) {
                var option = (question.options || []).find(function (opt) { return opt.value === selected; });
                return option ? option.label : selected;
            }).join(', ');
        }

        if (question.type === 'radio') {
            var match = (question.options || []).find(function (opt) { return opt.value === value; });
            return match ? match.label : String(value);
        }

        if (question.type === 'file') {
            if (this.fileAnswers[question.id]) {
                return this.fileAnswers[question.id].name;
            }
            return value ? String(value) : '';
        }

        if (question.type === 'consent') {
            return value === '1' || value === 1 || value === true ? (this.i18n.consentAccepted || 'Piekrīts') : '';
        }

        if (question.type === 'date' && value) {
            var parts = String(value).split('-');
            if (parts.length === 3) {
                return parts[2] + '/' + parts[1] + '/' + parts[0];
            }
        }

        if (Array.isArray(value)) {
            return value.join(', ');
        }

        return String(value || '');
    };

    MSForm.prototype.renderSummary = function (panel) {
        var settings = this.config.settings || {};
        var title = settings.summaryTitle || this.i18n.summaryTitle || 'Kopsavilkums';

        panel.appendChild(el('h3', { className: 'msf-form__step-title', text: title }));
        panel.appendChild(el('p', { className: 'msf-form__summary-intro', text: this.i18n.yourAnswers || 'Jūsu atbildes' }));

        var list = el('dl', { className: 'msf-form__summary-list' });

        getVisibleSteps(this.config.steps, this.answers).forEach(function (step) {
            if (!step.questions || !step.questions[0] || step.type === 'summary') {
                return;
            }

            var question = step.questions[0];
            var value = this.answers[question.id];

            if (value === undefined || value === null || value === '') {
                return;
            }

            list.appendChild(el('dt', { text: question.label }));
            list.appendChild(el('dd', { text: this.getAnswerDisplay(question, value) }));
        }.bind(this));

        panel.appendChild(list);

        var pricing = this.config.pricing || {};

        if (pricing.enabled) {
            panel.appendChild(this.renderPriceBreakdown(calculatePricing(this.config, this.answers)));
        }
    };

    MSForm.prototype.destroyDatePickers = function () {
        if (!this.datePickers || !this.datePickers.length) {
            this.datePickers = [];
            return;
        }

        this.datePickers.forEach(function (picker) {
            if (picker && typeof picker.destroy === 'function') {
                picker.destroy();
            }
        });
        this.datePickers = [];
    };

    MSForm.prototype.formatDateValue = function (date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    };

    MSForm.prototype.addDays = function (base, days) {
        var date = new Date(base.getTime());
        date.setDate(date.getDate() + days);
        return date;
    };

    MSForm.prototype.addMonths = function (base, months) {
        var date = new Date(base.getTime());
        date.setMonth(date.getMonth() + months);
        return date;
    };

    MSForm.prototype.initDateField = function (fieldWrap, question) {
        var self = this;
        var input = fieldWrap.querySelector('.msf-form__date-input');

        if (!input) {
            return;
        }

        var shortcuts = [
            { key: 'week', getDate: function () { return self.addDays(new Date(), 7); } },
            { key: 'month', getDate: function () { return self.addMonths(new Date(), 1); } },
            { key: 'quarter', getDate: function () { return self.addMonths(new Date(), 3); } }
        ];

        function applyDate(date) {
            var value = self.formatDateValue(date);
            self.answers[question.id] = value;

            if (input._flatpickr) {
                input._flatpickr.setDate(date, true);
            } else {
                input.value = value;
            }

            self.updatePriceBar();
        }

        fieldWrap.querySelectorAll('[data-msf-date-shortcut]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                var key = button.getAttribute('data-msf-date-shortcut');
                var shortcut = shortcuts.find(function (item) { return item.key === key; });

                if (shortcut) {
                    applyDate(shortcut.getDate());
                }
            });
        });

        if (typeof window.flatpickr !== 'function') {
            input.placeholder = self.i18n.datePlaceholder || 'dd/mm/yyyy';
            return;
        }

        var locale = (window.flatpickr.l10ns && window.flatpickr.l10ns.lv) ? window.flatpickr.l10ns.lv : undefined;
        var picker = window.flatpickr(input, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            altInputClass: 'msf-form__input',
            locale: locale,
            minDate: 'today',
            allowInput: true,
            defaultDate: input.value || null,
            onChange: function (selectedDates, dateStr) {
                if (dateStr) {
                    self.answers[question.id] = dateStr;
                    self.updatePriceBar();
                }
            }
        });

        this.datePickers.push(picker);
    };

    MSForm.prototype.renderStep = function () {
        var step = this.getCurrentStep();
        var settings = this.config.settings || {};
        var self = this;
        var transitionMs = this.getTransitionMs();
        var activeFieldWrap = null;
        var activeQuestion = null;

        if (!step) {
            this.body.innerHTML = '';
            return;
        }

        this.destroyDatePickers();
        this.body.innerHTML = '';
        this.updateProgress();
        this.updatePriceBar();

        var panel = el('div', {
            className: 'msf-form__step msf-form__step--enter',
            role: 'group',
            'aria-live': 'polite'
        });

        if (step.type === 'summary') {
            this.renderSummary(panel);
        } else {
            var question = step.questions[0];
            var stepTitleId = step.title ? this.fieldInputId(step.id, 'title') : '';

            if (step.title) {
                panel.appendChild(el('h3', {
                    className: 'msf-form__step-title',
                    id: stepTitleId,
                    text: step.title
                }));
                panel.setAttribute('aria-labelledby', stepTitleId);
            }

            if (step.description) {
                panel.appendChild(el('p', { className: 'msf-form__step-description', text: step.description }));
            }

            if (question.description) {
                panel.appendChild(el('p', { className: 'msf-form__question-description', text: question.description }));
            }

            var fieldWrap = this.renderField(question);
            var useFieldset = question.type === 'radio' || question.type === 'checkbox' || question.type === 'consent';

            if (useFieldset) {
                var fieldset = el('fieldset', { className: 'msf-form__fieldset' });

                if (question.type === 'consent') {
                    fieldset.setAttribute('aria-label', question.consentText || question.label || '');
                } else {
                    fieldset.appendChild(el('legend', { className: 'msf-form__label', text: question.label }));
                }

                fieldset.appendChild(fieldWrap);
                panel.appendChild(fieldset);
            } else {
                panel.appendChild(el('label', {
                    className: 'msf-form__label',
                    for: this.fieldInputId(question.id),
                    text: question.label
                }));
                panel.appendChild(fieldWrap);
            }

            if (!step.title && question.label) {
                panel.setAttribute('aria-label', question.label);
            }

            activeFieldWrap = fieldWrap;
            activeQuestion = question;

            if (this.config.pricing && this.config.pricing.enabled) {
                fieldWrap.addEventListener('input', function () {
                    self.updatePriceBar();
                });
                fieldWrap.addEventListener('change', function () {
                    self.updatePriceBar();
                });
            }
        }

        var actions = el('div', { className: 'msf-form__actions' });

        if (this.history.length > 0) {
            actions.appendChild(el('button', {
                type: 'button',
                className: 'msf-form__btn msf-form__btn--secondary',
                text: settings.backLabel || 'Atpakaļ'
            }));
            actions.lastChild.addEventListener('click', function () {
                self.goBack();
            });
        }

        var steps = this.getVisibleSteps();
        var currentIndex = steps.findIndex(function (item) { return item.id === step.id; });
        var isLast = currentIndex >= steps.length - 1;
        var question = step.type === 'summary' ? null : step.questions[0];
        var nextBtn = el('button', {
            type: 'button',
            className: 'msf-form__btn msf-form__btn--primary',
            text: isLast ? (settings.submitLabel || 'Nosūtīt') : (settings.nextLabel || 'Tālāk')
        });

        nextBtn.addEventListener('click', function () {
            if (self.isSubmitting) {
                return;
            }

            if (question && !self.validateCurrent(question)) {
                return;
            }

            if (question) {
                self.collectCurrent(question);
            }

            if (isLast) {
                self.submit(nextBtn);
                return;
            }

            self.goNext(step);
        });

        actions.appendChild(nextBtn);
        panel.appendChild(actions);
        this.body.appendChild(panel);

        if (activeQuestion && activeQuestion.type === 'date' && activeFieldWrap) {
            this.initDateField(activeFieldWrap, activeQuestion);
        }

        window.setTimeout(function () {
            panel.classList.remove('msf-form__step--enter');
        }, 20);

        if (step.interval && step.interval.afterPreviousMs) {
            window.setTimeout(function () {
                panel.classList.add('msf-form__step--ready');
            }, parseInt(step.interval.afterPreviousMs, 10) || 0);
        } else {
            panel.classList.add('msf-form__step--ready');
        }

        panel.style.setProperty('--msf-transition-ms', transitionMs + 'ms');
    };

    MSForm.prototype.goNext = function (currentStep) {
        this.history.push(currentStep.id);

        var steps = this.getVisibleSteps();
        var currentIndex = steps.findIndex(function (step) { return step.id === currentStep.id; });
        var nextStep = steps[currentIndex + 1];

        if (!nextStep) {
            return;
        }

        this.currentStepId = nextStep.id;
        this.renderStep();
    };

    MSForm.prototype.goBack = function () {
        var previousId = this.history.pop();

        if (!previousId) {
            return;
        }

        this.currentStepId = previousId;
        this.renderStep();
    };

    MSForm.prototype.renderField = function (question) {
        var wrap = el('div', { className: 'msf-form__field' });
        var value = this.answers[question.id];
        var inputId = this.fieldInputId(question.id);
        var self = this;

        switch (question.type) {
            case 'textarea':
                wrap.appendChild(el('textarea', {
                    className: 'msf-form__input',
                    id: inputId,
                    name: question.id,
                    rows: '4'
                }));
                wrap.querySelector('textarea').value = value || '';
                break;
            case 'number':
                wrap.appendChild(el('input', {
                    className: 'msf-form__input',
                    id: inputId,
                    type: 'number',
                    name: question.id
                }));
                if (value !== undefined) {
                    wrap.querySelector('input').value = value;
                }
                break;
            case 'email':
                wrap.appendChild(el('input', {
                    className: 'msf-form__input',
                    id: inputId,
                    type: 'email',
                    name: question.id,
                    inputmode: 'email',
                    autocomplete: 'email'
                }));
                wrap.querySelector('input').value = value || '';
                break;
            case 'tel':
                wrap.appendChild(el('input', {
                    className: 'msf-form__input',
                    id: inputId,
                    type: 'tel',
                    name: question.id,
                    inputmode: 'tel',
                    autocomplete: 'tel'
                }));
                wrap.querySelector('input').value = value || '';
                break;
            case 'radio':
                (question.options || []).forEach(function (option) {
                    var optionInputId = self.fieldInputId(question.id, option.value);
                    var label = el('label', {
                        className: 'msf-form__choice',
                        html: '<input type="radio" id="' + optionInputId + '" name="' + question.id + '" value="' + option.value + '"> ' + option.label
                    });
                    if (value === option.value) {
                        label.querySelector('input').checked = true;
                    }
                    wrap.appendChild(label);
                });
                break;
            case 'checkbox':
                (question.options || []).forEach(function (option) {
                    var optionInputId = self.fieldInputId(question.id, option.value);
                    var label = el('label', {
                        className: 'msf-form__choice',
                        html: '<input type="checkbox" id="' + optionInputId + '" name="' + question.id + '[]" value="' + option.value + '"> ' + option.label
                    });
                    if (Array.isArray(value) && value.indexOf(option.value) !== -1) {
                        label.querySelector('input').checked = true;
                    }
                    wrap.appendChild(label);
                });
                break;
            case 'date':
                var dateField = el('div', { className: 'msf-form__date-field' });
                var shortcutsWrap = el('div', { className: 'msf-form__date-shortcuts' });
                var shortcutLabels = [
                    ['week', this.i18n.dateAfterWeek || 'Pēc nedēļas'],
                    ['month', this.i18n.dateAfterMonth || 'Pēc mēneša'],
                    ['quarter', this.i18n.dateAfterThreeMonths || 'Pēc 3 mēnešiem']
                ];

                shortcutLabels.forEach(function (item) {
                    shortcutsWrap.appendChild(el('button', {
                        type: 'button',
                        className: 'msf-form__btn msf-form__btn--secondary msf-form__date-shortcut',
                        'data-msf-date-shortcut': item[0],
                        text: item[1]
                    }));
                });

                var pickerWrap = el('div', { className: 'msf-form__date-picker-wrap' });
                var dateInput = el('input', {
                    className: 'msf-form__input msf-form__date-input',
                    id: inputId,
                    type: 'text',
                    name: question.id,
                    autocomplete: 'off',
                    placeholder: this.i18n.datePlaceholder || 'dd/mm/yyyy'
                });
                dateInput.value = value || '';
                pickerWrap.appendChild(dateInput);
                dateField.appendChild(shortcutsWrap);
                dateField.appendChild(pickerWrap);
                wrap.appendChild(dateField);
                break;
            case 'file':
                var maxMb = (question.validation && question.validation.maxSizeMb) ? question.validation.maxSizeMb : 5;
                var fileInput = el('input', {
                    className: 'msf-form__input',
                    id: inputId,
                    type: 'file',
                    name: question.id,
                    accept: '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx'
                });
                wrap.appendChild(fileInput);
                wrap.appendChild(el('p', {
                    className: 'msf-form__field-hint',
                    text: (this.i18n.fileHint || 'Maks. %s MB (JPG, PNG, PDF, DOC)').replace('%s', String(maxMb))
                }));
                if (this.fileAnswers[question.id]) {
                    wrap.appendChild(el('p', {
                        className: 'msf-form__file-selected',
                        text: this.fileAnswers[question.id].name
                    }));
                }
                break;
            case 'consent':
                var consentHtml = (question.consentText || question.label || '');
                if (question.consentLinkUrl) {
                    consentHtml += ' <a href="' + question.consentLinkUrl + '" target="_blank" rel="noopener noreferrer">' + (question.consentLinkLabel || question.consentLinkUrl) + '</a>';
                }
                var consentLabel = el('label', {
                    className: 'msf-form__choice msf-form__consent',
                    html: '<input type="checkbox" id="' + inputId + '" name="' + question.id + '" value="1"> ' + consentHtml
                });
                if (value === '1' || value === 1 || value === true) {
                    consentLabel.querySelector('input').checked = true;
                }
                wrap.appendChild(consentLabel);
                break;
            default: {
                var contactFormat = getContactFormat(question);
                var inputType = 'text';
                var inputAttrs = {
                    className: 'msf-form__input',
                    id: inputId,
                    type: inputType,
                    name: question.id
                };

                if (contactFormat === 'email') {
                    inputAttrs.type = 'email';
                    inputAttrs.inputmode = 'email';
                    inputAttrs.autocomplete = 'email';
                } else if (contactFormat === 'phone') {
                    inputAttrs.type = 'tel';
                    inputAttrs.inputmode = 'tel';
                    inputAttrs.autocomplete = 'tel';
                }

                wrap.appendChild(el('input', inputAttrs));
                wrap.querySelector('input').value = value || '';
                break;
            }
        }

        return wrap;
    };

    MSForm.prototype.showFieldError = function (message, question) {
        var step = this.body.querySelector('.msf-form__step');
        var errorId = question ? this.fieldErrorId(question.id) : '';
        var errorEl = el('p', {
            className: 'msf-form__error',
            id: errorId,
            role: 'alert',
            tabindex: '-1',
            text: message
        });
        var focusTarget = null;

        if (step) {
            var actions = step.querySelector('.msf-form__actions');

            if (actions) {
                step.insertBefore(errorEl, actions);
            } else {
                step.appendChild(errorEl);
            }
        }

        if (question) {
            focusTarget = this.getQuestionControl(question);

            if (focusTarget) {
                focusTarget.setAttribute('aria-invalid', 'true');

                if (errorId) {
                    focusTarget.setAttribute('aria-describedby', errorId);
                }
            }
        }

        if (!focusTarget) {
            focusTarget = errorEl;
        }

        focusTarget.focus();
    };

    MSForm.prototype.validateCurrent = function (question) {
        var requiredMessage = this.i18n.required || 'Šis lauks ir obligāts.';

        this.clearFieldErrors();

        var contactFormat = getContactFormat(question);

        if (contactFormat) {
            var contactField = this.getQuestionControl(question);
            var contactValue = contactField ? String(contactField.value || '').trim() : '';

            if (!contactValue) {
                if (!question.required) {
                    return true;
                }

                this.showFieldError(requiredMessage, question);
                return false;
            }

            if (contactFormat === 'email' && !isValidEmail(contactValue)) {
                this.showFieldError(this.i18n.invalidEmail || 'Lūdzu, ievadiet derīgu e-pasta adresi.', question);
                return false;
            }

            if (contactFormat === 'phone' && !isValidPhone(contactValue)) {
                this.showFieldError(this.i18n.invalidPhone || 'Lūdzu, ievadiet derīgu tālruņa numuru.', question);
                return false;
            }

            return true;
        }

        if (question.type === 'date') {
            var dateField = this.getQuestionControl(question);
            var dateValue = dateField ? String(dateField.value || '').trim() : '';

            if (!dateValue) {
                if (!question.required) {
                    return true;
                }

                this.showFieldError(requiredMessage, question);
                return false;
            }

            if (!isValidIsoDate(dateValue)) {
                this.showFieldError(this.i18n.invalidDate || 'Lūdzu, ievadiet derīgu datumu.', question);
                return false;
            }

            return true;
        }

        if (!question.required) {
            return true;
        }

        var valid = false;

        if (question.type === 'checkbox') {
            valid = !!this.body.querySelector('[name="' + question.id + '[]"]:checked');
        } else if (question.type === 'radio') {
            valid = !!this.body.querySelector('[name="' + question.id + '"]:checked');
        } else if (question.type === 'consent') {
            valid = !!this.body.querySelector('[name="' + question.id + '"]:checked');
        } else if (question.type === 'file') {
            var fileField = this.body.querySelector('[name="' + question.id + '"]');
            valid = !!(this.fileAnswers[question.id] || (fileField && fileField.files && fileField.files[0]));
        } else {
            var field = this.getQuestionControl(question);
            valid = field ? String(field.value || '').trim() !== '' : false;
        }

        if (!valid) {
            this.showFieldError(requiredMessage, question);
        }

        return valid;
    };

    MSForm.prototype.collectCurrent = function (question) {
        if (question.type === 'checkbox') {
            this.answers[question.id] = Array.prototype.map.call(
                this.body.querySelectorAll('[name="' + question.id + '[]"]:checked'),
                function (input) { return input.value; }
            );
            return;
        }

        if (question.type === 'radio') {
            var checked = this.body.querySelector('[name="' + question.id + '"]:checked');
            this.answers[question.id] = checked ? checked.value : '';
            return;
        }

        if (question.type === 'consent') {
            var consentBox = this.body.querySelector('[name="' + question.id + '"]');
            this.answers[question.id] = consentBox && consentBox.checked ? '1' : '';
            return;
        }

        if (question.type === 'file') {
            var fileBox = this.body.querySelector('[name="' + question.id + '"]');
            if (fileBox && fileBox.files && fileBox.files[0]) {
                this.fileAnswers[question.id] = fileBox.files[0];
                this.answers[question.id] = fileBox.files[0].name;
            }
            return;
        }

        var field = this.body.querySelector('[name="' + question.id + '"]');
        this.answers[question.id] = field ? field.value : '';
    };

    MSForm.prototype.setSubmitting = function (isSubmitting, primaryBtn, originalText) {
        this.isSubmitting = isSubmitting;

        if (!primaryBtn) {
            return;
        }

        primaryBtn.disabled = isSubmitting;

        if (isSubmitting) {
            primaryBtn.setAttribute('aria-busy', 'true');
            primaryBtn.textContent = this.i18n.submitting || 'Nosūta…';
            return;
        }

        primaryBtn.removeAttribute('aria-busy');
        primaryBtn.textContent = originalText || primaryBtn.textContent;
    };

    MSForm.prototype.showSubmitError = function (message) {
        var step = this.body.querySelector('.msf-form__step');
        var existing = this.body.querySelector('.msf-form__submit-error');

        if (existing) {
            existing.remove();
        }

        var errorEl = el('p', {
            className: 'msf-form__error msf-form__submit-error',
            role: 'alert',
            tabindex: '-1',
            text: message
        });

        if (step) {
            var actions = step.querySelector('.msf-form__actions');

            if (actions) {
                step.insertBefore(errorEl, actions);
            } else {
                step.appendChild(errorEl);
            }
        }

        errorEl.focus();
    };

    MSForm.prototype.submit = function (triggerBtn) {
        var self = this;
        var fallbackError = this.i18n.error || 'Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.';
        var fallbackSuccess = this.successMessage || 'Paldies! Jūsu pieteikums ir saņemts.';
        var primaryBtn = triggerBtn || this.body.querySelector('.msf-form__btn--primary');
        var originalText = primaryBtn ? primaryBtn.textContent : '';

        if (this.isPreview) {
            this.body.innerHTML = '<div class="msf-form__success"><p>' + (this.i18n.previewSubmit || 'Priekšskatījums — nosūtīšana atspējota.') + '</p></div>';
            return;
        }

        if (this.isSubmitting) {
            return;
        }

        var existingSubmitError = this.body.querySelector('.msf-form__submit-error');

        if (existingSubmitError) {
            existingSubmitError.remove();
        }

        this.setSubmitting(true, primaryBtn, originalText);

        var data = new FormData();
        data.append('action', 'msf_submit_form');
        data.append('nonce', this.nonce);
        data.append('formId', String(this.formId));
        var answersPayload = Object.assign({}, this.answers);
        Object.keys(this.fileAnswers).forEach(function (qid) {
            delete answersPayload[qid];
        });

        data.append('answers', JSON.stringify(answersPayload));
        data.append('pageUrl', this.pageUrl);
        data.append('msf_hp', this.hp ? this.hp.value : '');

        Object.keys(this.fileAnswers).forEach(function (qid) {
            data.append('msf_file_' + qid, self.fileAnswers[qid]);
        });

        fetch(this.ajaxUrl, {
            method: 'POST',
            body: data,
            credentials: 'same-origin'
        })
            .then(function (response) {
                return response.text().then(function (text) {
                    var payload = null;

                    try {
                        payload = JSON.parse(text);
                    } catch (e) {
                        throw new Error(fallbackError);
                    }

                    if (!response.ok && (!payload || !payload.success)) {
                        throw new Error(getPayloadMessage(payload, fallbackError));
                    }

                    return payload;
                });
            })
            .then(function (payload) {
                if (!payload || !payload.success) {
                    throw new Error(getPayloadMessage(payload, fallbackError));
                }

                if (self.progressWrap) {
                    self.progressWrap.style.display = 'none';
                }

                if (self.priceBar) {
                    self.priceBar.hidden = true;
                }

                var message = getPayloadMessage(payload, fallbackSuccess);
                self.body.innerHTML = '<div class="msf-form__success"><p>' + message + '</p></div>';
            })
            .catch(function (error) {
                var message = (error && error.message) ? error.message : fallbackError;

                if (message === 'undefined' || !message) {
                    message = fallbackError;
                }

                self.setSubmitting(false, primaryBtn, originalText);
                self.showSubmitError(message);
            });
    };

    function initForm(root) {
        if (!root || root.getAttribute('data-msf-initialized') === '1') {
            return null;
        }

        root.setAttribute('data-msf-initialized', '1');
        var instance = new MSForm(root);
        instance.init();
        return instance;
    }

    window.msfInitForm = initForm;

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.msf-form').forEach(function (root) {
            initForm(root);
        });
    });
})();
