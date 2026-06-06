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
        fallback = fallback || 'Something went wrong. Please try again.';

        if (!payload) {
            return fallback;
        }

        if (!payload.data) {
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
        this.progressBar = root.querySelector('.msf-form__progress-bar');
        this.hp = root.querySelector('input[name="msf_hp"]');
        this.currentIndex = 0;
        this.answers = {};
        this.i18n = parseJson(root.getAttribute('data-msf-i18n'), null)
            || (window.msfRuntime && window.msfRuntime.i18n)
            || {
                required: 'This field is required.',
                submitting: 'Sending…',
                error: 'Something went wrong. Please try again.'
            };
    }

    MSForm.prototype.init = function () {
        if (!this.config || !this.config.steps || !this.config.steps.length) {
            this.body.innerHTML = '';
            return;
        }

        this.renderStep();
    };

    MSForm.prototype.getVisibleSteps = function () {
        return this.config.steps;
    };

    MSForm.prototype.renderStep = function () {
        var steps = this.getVisibleSteps();
        var step = steps[this.currentIndex];
        var question = step.questions[0];
        var settings = this.config.settings;
        var self = this;

        this.body.innerHTML = '';
        this.updateProgress();

        var panel = el('div', { className: 'msf-form__step' });

        if (step.title) {
            panel.appendChild(el('h3', { className: 'msf-form__step-title', text: step.title }));
        }

        panel.appendChild(el('label', { className: 'msf-form__label', text: question.label }));
        panel.appendChild(this.renderField(question));

        var actions = el('div', { className: 'msf-form__actions' });

        if (this.currentIndex > 0) {
            actions.appendChild(el('button', {
                type: 'button',
                className: 'msf-form__btn msf-form__btn--secondary',
                text: settings.backLabel || 'Atpakaļ'
            }));
            actions.lastChild.addEventListener('click', function () {
                self.currentIndex -= 1;
                self.renderStep();
            });
        }

        var isLast = this.currentIndex >= steps.length - 1;
        var nextBtn = el('button', {
            type: 'button',
            className: 'msf-form__btn msf-form__btn--primary',
            text: isLast ? (settings.submitLabel || 'Nosūtīt') : (settings.nextLabel || 'Tālāk')
        });

        nextBtn.addEventListener('click', function () {
            if (!self.validateCurrent(question)) {
                return;
            }

            self.collectCurrent(question);

            if (isLast) {
                self.submit();
                return;
            }

            self.currentIndex += 1;
            self.renderStep();
        });

        actions.appendChild(nextBtn);
        panel.appendChild(actions);
        this.body.appendChild(panel);
    };

    MSForm.prototype.renderField = function (question) {
        var wrap = el('div', { className: 'msf-form__field' });
        var value = this.answers[question.id];

        switch (question.type) {
            case 'textarea':
                wrap.appendChild(el('textarea', {
                    className: 'msf-form__input',
                    name: question.id,
                    rows: '4'
                }));
                wrap.querySelector('textarea').value = value || '';
                break;
            case 'number':
                wrap.appendChild(el('input', {
                    className: 'msf-form__input',
                    type: 'number',
                    name: question.id
                }));
                wrap.querySelector('input').value = value !== undefined ? value : '';
                break;
            case 'email':
                wrap.appendChild(el('input', {
                    className: 'msf-form__input',
                    type: 'email',
                    name: question.id
                }));
                wrap.querySelector('input').value = value || '';
                break;
            case 'radio':
                (question.options || []).forEach(function (option) {
                    var id = question.id + '_' + option.value;
                    var label = el('label', { className: 'msf-form__choice', html: '<input type="radio" name="' + question.id + '" value="' + option.value + '"> ' + option.label });
                    if (value === option.value) {
                        label.querySelector('input').checked = true;
                    }
                    wrap.appendChild(label);
                });
                break;
            case 'checkbox':
                (question.options || []).forEach(function (option) {
                    var label = el('label', { className: 'msf-form__choice', html: '<input type="checkbox" name="' + question.id + '[]" value="' + option.value + '"> ' + option.label });
                    if (Array.isArray(value) && value.indexOf(option.value) !== -1) {
                        label.querySelector('input').checked = true;
                    }
                    wrap.appendChild(label);
                });
                break;
            default:
                wrap.appendChild(el('input', {
                    className: 'msf-form__input',
                    type: 'text',
                    name: question.id
                }));
                wrap.querySelector('input').value = value || '';
        }

        return wrap;
    };

    MSForm.prototype.validateCurrent = function (question) {
        var field = this.body.querySelector('[name="' + question.id + '"], [name="' + question.id + '[]"]');
        var message = this.i18n.required || 'This field is required.';
        var existing = this.body.querySelector('.msf-form__error');

        if (existing) {
            existing.remove();
        }

        if (!question.required) {
            return true;
        }

        var valid = false;

        if (question.type === 'checkbox') {
            valid = !!this.body.querySelector('[name="' + question.id + '[]"]:checked');
        } else if (question.type === 'radio') {
            valid = !!this.body.querySelector('[name="' + question.id + '"]:checked');
        } else if (field) {
            valid = String(field.value || '').trim() !== '';
        }

        if (!valid) {
            this.body.querySelector('.msf-form__step').appendChild(el('p', { className: 'msf-form__error', text: message }));
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

        var field = this.body.querySelector('[name="' + question.id + '"]');
        this.answers[question.id] = field ? field.value : '';
    };

    MSForm.prototype.updateProgress = function () {
        if (!this.progressBar) {
            return;
        }

        var total = this.getVisibleSteps().length;
        var percent = total ? ((this.currentIndex + 1) / total) * 100 : 0;
        this.progressBar.style.width = percent + '%';
    };

    MSForm.prototype.submit = function () {
        var self = this;
        var fallbackError = this.i18n.error || 'Something went wrong. Please try again.';
        var fallbackSuccess = this.successMessage || 'Thank you! Your submission was received.';

        this.body.innerHTML = '<p class="msf-form__loading">' + (this.i18n.submitting || 'Sending…') + '</p>';

        var data = new FormData();
        data.append('action', 'msf_submit_form');
        data.append('nonce', this.nonce);
        data.append('formId', String(this.formId));
        data.append('answers', JSON.stringify(this.answers));
        data.append('pageUrl', this.pageUrl);
        data.append('msf_hp', this.hp ? this.hp.value : '');

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

                var progress = self.root.querySelector('.msf-form__progress');

                if (progress) {
                    progress.style.display = 'none';
                }

                var message = getPayloadMessage(payload, fallbackSuccess);

                self.body.innerHTML = '<div class="msf-form__success"><p>' + message + '</p></div>';
            })
            .catch(function (error) {
                var message = (error && error.message) ? error.message : fallbackError;

                if (message === 'undefined' || !message) {
                    message = fallbackError;
                }

                self.body.innerHTML = '<p class="msf-form__error">' + message + '</p>';
            });
    };

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.msf-form').forEach(function (root) {
            new MSForm(root).init();
        });
    });
})();
