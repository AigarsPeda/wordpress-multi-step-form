(function () {
  "use strict";

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
        if (key === "className") {
          node.className = attrs[key];
        } else if (key === "text") {
          node.textContent = attrs[key];
        } else if (key === "html") {
          node.innerHTML = attrs[key];
        } else {
          node.setAttribute(key, attrs[key]);
        }
      });
    }

    (children || []).forEach(function (child) {
      if (typeof child === "string") {
        node.appendChild(document.createTextNode(child));
      } else if (child) {
        node.appendChild(child);
      }
    });

    return node;
  }

  function getPayloadMessage(payload, fallback) {
    fallback = fallback || "Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.";

    if (!payload || !payload.data) {
      return fallback;
    }

    if (typeof payload.data === "string") {
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

    var questionId = condition.questionId || "";
    var operator = condition.operator || "equals";
    var expected = condition.value;
    var actual =
      questionId && answers[questionId] !== undefined
        ? answers[questionId]
        : null;

    switch (operator) {
      case "notEquals":
        return String(actual) !== String(expected);
      case "greaterThan":
        return parseFloat(actual) > parseFloat(expected);
      case "lessThan":
        return parseFloat(actual) < parseFloat(expected);
      case "greaterOrEqual":
        return parseFloat(actual) >= parseFloat(expected);
      case "lessOrEqual":
        return parseFloat(actual) <= parseFloat(expected);
      case "contains":
        if (Array.isArray(actual)) {
          return actual.indexOf(expected) !== -1;
        }
        return String(actual).indexOf(String(expected)) !== -1;
      case "notContains":
        if (Array.isArray(actual)) {
          return actual.indexOf(expected) === -1;
        }
        return String(actual).indexOf(String(expected)) === -1;
      case "isEmpty":
        return (
          actual === null ||
          actual === "" ||
          (Array.isArray(actual) && !actual.length)
        );
      case "isNotEmpty":
        return !(
          actual === null ||
          actual === "" ||
          (Array.isArray(actual) && !actual.length)
        );
      case "in":
        var list = Array.isArray(expected)
          ? expected
          : String(expected)
              .split(",")
              .map(function (item) {
                return item.trim();
              });
        if (Array.isArray(actual)) {
          return actual.some(function (item) {
            return list.indexOf(String(item)) !== -1;
          });
        }
        return list.indexOf(String(actual)) !== -1;
      case "notIn":
        var notList = Array.isArray(expected)
          ? expected
          : String(expected)
              .split(",")
              .map(function (item) {
                return item.trim();
              });
        if (Array.isArray(actual)) {
          return !actual.some(function (item) {
            return notList.indexOf(String(item)) !== -1;
          });
        }
        return notList.indexOf(String(actual)) === -1;
      case "equals":
      default:
        if (Array.isArray(actual)) {
          return actual.indexOf(expected) !== -1;
        }
        return String(actual) === String(expected);
    }
  }

  function evaluateGroup(group, answers) {
    var logic = group.logic === "or" ? "or" : "and";
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

    if (logic === "or") {
      return results.some(function (result) {
        return result;
      });
    }

    return results.every(function (result) {
      return result;
    });
  }

  function isVisible(visibility, answers) {
    visibility = visibility || { mode: "always" };

    if (visibility.mode === "never") {
      return false;
    }

    if (visibility.mode !== "conditional") {
      return true;
    }

    return evaluateGroup(visibility, answers);
  }

  function getGuestCount(pricing, answers) {
    var questionId = pricing.perGuestQuestionId || "";

    if (
      questionId &&
      answers[questionId] !== undefined &&
      answers[questionId] !== ""
    ) {
      return Math.max(0, parseFloat(answers[questionId]) || 0);
    }

    return 0;
  }

  function formatMoney(amount, currency) {
    var formatted = Number(amount).toFixed(2).replace(".", ",");

    if (currency === "EUR") {
      return formatted + " €";
    }

    return formatted + " " + currency;
  }

  function hasGuestCountAnswer(pricing, answers) {
    var guestQuestionId = pricing.perGuestQuestionId || "";

    if (!guestQuestionId) {
      return true;
    }

    if (
      answers[guestQuestionId] === undefined ||
      answers[guestQuestionId] === null ||
      answers[guestQuestionId] === ""
    ) {
      return false;
    }

    return true;
  }

  function calculatePricing(config, answers, options) {
    options = options || {};
    var pricing = config.pricing || {};

    if (!pricing.enabled) {
      return { total: 0, lines: [], currency: pricing.currency || "EUR" };
    }

    var currency = pricing.currency || "EUR";

    if (options.estimated && !hasGuestCountAnswer(pricing, answers)) {
      return { total: 0, lines: [], currency: currency };
    }

    var total = parseFloat(pricing.baseAmount) || 0;
    var lines = [];
    var guestCount = getGuestCount(pricing, answers);
    var perGuestRate = parseFloat(pricing.perGuestRate) || 0;

    if (total > 0) {
      lines.push({ label: "Bāzes maksa", amount: total });
    }

    if (perGuestRate > 0 && guestCount > 0) {
      var guestAmount = perGuestRate * guestCount;
      total += guestAmount;
      lines.push({
        label:
          "Ēdiens (" +
          guestCount +
          " viesi × " +
          formatMoney(perGuestRate, currency) +
          ")",
        amount: guestAmount,
      });
    }

    getVisibleSteps(config.steps, answers).forEach(function (step) {
      if (!step.questions || !step.questions[0] || step.type === "summary") {
        return;
      }

      var question = step.questions[0];
      var answer = answers[question.id];

      if (answer === null || answer === undefined || answer === "") {
        return;
      }

      if (question.type !== "radio" && question.type !== "checkbox") {
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
      currency: currency,
    };
  }

  function getVisibleSteps(steps, answers) {
    return (steps || []).filter(function (step) {
      return isVisible(step.visibility, answers);
    });
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function isValidPhone(value) {
    var trimmed = String(value || "").trim();

    if (!trimmed || !/^[0-9+\s().\-]+$/.test(trimmed)) {
      return false;
    }

    var digits = trimmed.replace(/\D+/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }

  function isValidIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim())) {
      return false;
    }

    var parts = String(value).split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    var date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function getContactFormat(question) {
    if (!question) {
      return null;
    }

    if (question.type === "email") {
      return "email";
    }

    if (question.type === "tel") {
      return "phone";
    }

    if (
      question.type === "text" &&
      (question.format === "email" || question.format === "phone")
    ) {
      return question.format;
    }

    return null;
  }

  function MSForm(root) {
    this.root = root;
    this.config = parseJson(root.getAttribute("data-msf-config"), null);
    this.successMessage = root.getAttribute("data-msf-success") || "";
    this.pageUrl =
      root.getAttribute("data-msf-page-url") || window.location.href;
    this.formId = parseInt(root.getAttribute("data-msf-form-id"), 10) || 0;
    this.ajaxUrl =
      root.getAttribute("data-msf-ajax-url") ||
      (window.msfRuntime && window.msfRuntime.ajaxUrl) ||
      "/wp-admin/admin-ajax.php";
    this.nonce =
      root.getAttribute("data-msf-nonce") ||
      (window.msfRuntime && window.msfRuntime.nonce) ||
      "";
    this.body = root.querySelector(".msf-form__body");
    this.progressWrap = root.querySelector(".msf-form__progress");
    this.progressStepLabel = root.querySelector(".msf-form__progress-step");
    this.progressPrice = root.querySelector(".msf-form__progress-price");
    this.progressPriceValue = null;
    this.progressBar = null;
    this.lastPriceTotal = null;
    this.ensureProgressBar();
    this.priceBar = root.querySelector(".msf-form__price-bar");
    this.hp = root.querySelector('input[name="msf_hp"]');
    this.currentStepId = null;
    this.history = [];
    this.answers = {};
    this.fileAnswers = {};
    this.datePickers = [];
    this.bodyQuestionMinHeight = 0;
    this.isSubmitting = false;
    this.isPreview = root.getAttribute("data-msf-preview") === "1";
    this.i18n = parseJson(root.getAttribute("data-msf-i18n"), null) ||
      (window.msfRuntime && window.msfRuntime.i18n) || {
        required: "Šis lauks ir obligāts.",
        submitting: "Nosūta…",
        error: "Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.",
        estimatedPrice: "Aptuvenā cena",
        summaryTitle: "Kopsavilkums",
        yourAnswers: "Jūsu atbildes",
        total: "Kopā",
        consentAccepted: "Piekrīts",
        fileHint: "Maks. %s MB (JPG, PNG, PDF, DOC)",
        previewSubmit:
          "Priekšskatījums — saglabājiet formu un skatiet lapā, lai nosūtītu.",
        loading: "Ielādē formu…",
        datePlaceholder: "dd/mm/yyyy",
        dateAfterWeek: "Pēc nedēļas",
        dateAfterMonth: "Pēc mēneša",
        dateAfterThreeMonths: "Pēc 3 mēnešiem",
        dateExamplesLabel: "Populāri varianti",
        invalidEmail: "Lūdzu, ievadiet derīgu e-pasta adresi.",
        invalidPhone: "Lūdzu, ievadiet derīgu tālruņa numuru.",
        invalidDate: "Lūdzu, ievadiet derīgu datumu.",
        progressLabel: "Formas progress",
        stepCounter: "%current% no %total%",
        numberPlaceholder: "piemēram, 80",
        numberGuestPlaceholder: "80",
        numberRange: "No %min% līdz %max%",
        numberRangeExample: "piemēram, %example% · no %min% līdz %max%",
        numberExamplesLabel: "Populāri varianti",
        numberDecrease: "Samazināt",
        numberIncrease: "Palielināt",
      };
  }

  MSForm.prototype.ensureProgressBar = function () {
    var root = this.root;

    if (!this.progressWrap) {
      this.progressWrap = root.querySelector(".msf-form__progress");
    }

    if (!this.progressStepLabel) {
      this.progressStepLabel = root.querySelector(".msf-form__progress-step");
    }

    if (!this.progressPrice) {
      this.progressPrice = root.querySelector(".msf-form__progress-price");
    }

    if (this.progressPrice && !this.progressPriceValue) {
      this.progressPriceValue = this.progressPrice.querySelector(
        ".msf-form__price-value",
      );
    }

    if (!this.progressWrap) {
      return;
    }

    var fill = this.progressWrap.querySelector(
      ".msf-form__progress-bar, .msf-form__progress-fill",
    );

    if (!fill) {
      fill = root.querySelector(
        ".msf-form__progress-bar, .msf-form__progress-fill",
      );
    }

    if (!fill) {
      fill = document.createElement("div");
      fill.className = "msf-form__progress-bar";
    } else if (fill.parentNode !== this.progressWrap) {
      this.progressWrap.appendChild(fill);
    }

    if (!fill.classList.contains("msf-form__progress-bar")) {
      fill.classList.add("msf-form__progress-bar");
    }

    this.progressBar = fill;
  };

  MSForm.prototype.fieldInputId = function (questionId, suffix) {
    var id = "msf-field-" + this.formId + "-" + questionId;

    return suffix ? id + "-" + suffix : id;
  };

  MSForm.prototype.fieldErrorId = function (questionId) {
    return "msf-error-" + this.formId + "-" + questionId;
  };

  MSForm.prototype.getQuestionControl = function (question) {
    if (!question || !this.body) {
      return null;
    }

    if (question.type === "checkbox") {
      return this.body.querySelector('[name="' + question.id + '[]"]');
    }

    return (
      this.body.querySelector('[name="' + question.id + '"]') ||
      document.getElementById(this.fieldInputId(question.id))
    );
  };

  MSForm.prototype.clearFieldErrors = function () {
    if (!this.body) {
      return;
    }

    this.body.querySelectorAll(".msf-form__error").forEach(function (node) {
      node.remove();
    });

    this.body
      .querySelectorAll('[aria-invalid="true"]')
      .forEach(function (field) {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
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
      var found = steps.find(function (step) {
        return step.id === self.currentStepId;
      });
      if (found) {
        return found;
      }
    }

    return steps[0] || null;
  };

  MSForm.prototype.init = function () {
    if (!this.config || !this.config.steps || !this.config.steps.length) {
      this.body.innerHTML = "";
      return;
    }

    var first = this.getVisibleSteps()[0];

    if (!first) {
      this.body.innerHTML = "";
      return;
    }

    var self = this;

    this.currentStepId = first.id;

    var start = function () {
      self.precomputeBodyMinHeight();
      self.renderStep();
    };

    if (this.body.offsetWidth) {
      start();
    } else if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(start);
    } else {
      window.setTimeout(start, 0);
    }
  };

  MSForm.prototype.updateProgress = function () {
    this.ensureProgressBar();

    if (!this.progressBar || !this.progressWrap) {
      return;
    }

    var settings = this.config.settings || {};
    var steps = this.getVisibleSteps();

    if (!this.progressHeader) {
      this.progressHeader = this.root.querySelector(
        ".msf-form__progress-header",
      );
    }

    if (!settings.showProgressBar) {
      if (this.progressHeader) {
        this.progressHeader.hidden = true;
      } else if (this.progressWrap) {
        this.progressWrap.style.display = "none";
      }

      return;
    }

    if (this.progressHeader) {
      this.progressHeader.hidden = false;
    }

    this.progressWrap.style.display = "";
    var index = steps.findIndex(
      function (step) {
        return step.id === this.currentStepId;
      }.bind(this),
    );

    if (index < 0) {
      index = 0;
    }

    var percent = steps.length ? ((index + 1) / steps.length) * 100 : 0;

    this.progressBar.style.width = percent + "%";
    this.progressWrap.setAttribute("role", "progressbar");
    this.progressWrap.setAttribute("aria-valuemin", "0");
    this.progressWrap.setAttribute("aria-valuemax", "100");
    this.progressWrap.setAttribute(
      "aria-valuenow",
      String(Math.round(percent)),
    );
    this.progressWrap.setAttribute(
      "aria-label",
      this.i18n.progressLabel || "Formas progress",
    );

    if (this.progressStepLabel) {
      var current = index + 1;
      var total = steps.length;
      var counterTemplate = this.i18n.stepCounter || "%current% no %total%";
      var stepText = counterTemplate
        .replace(
          "%current%",
          '<span class="msf-form__progress-step-current">' +
            current +
            "</span>",
        )
        .replace(
          "%total%",
          '<span class="msf-form__progress-step-total">' + total + "</span>",
        );

      this.progressStepLabel.innerHTML = stepText;
      this.progressStepLabel.hidden = total < 2;
    }
  };

  MSForm.prototype.updatePriceBar = function () {
    var pricing = this.config.pricing || {};
    var displayOn = pricing.displayOn || "summary";
    var priceHost = this.progressPrice || this.priceBar;
    var priceValueEl =
      this.progressPriceValue ||
      (priceHost ? priceHost.querySelector(".msf-form__price-value") : null);
    var shouldShow =
      pricing.enabled &&
      displayOn !== "summary" &&
      displayOn !== "none" &&
      (displayOn === "sticky" || displayOn === "both");

    if (this.priceBar && this.progressPrice) {
      this.priceBar.hidden = true;
    }

    if (!priceHost || !priceValueEl) {
      return;
    }

    if (!shouldShow) {
      priceHost.hidden = true;
      return;
    }

    var result = calculatePricing(this.config, this.getAnswersForPricing(), {
      estimated: true,
    });
    var formattedTotal = formatMoney(result.total, result.currency);
    var shouldFlash =
      this.lastPriceTotal !== null && this.lastPriceTotal !== formattedTotal;
    var priceLabel = this.i18n.estimatedPrice || "Aptuvenā cena";

    priceHost.hidden = false;
    priceValueEl.textContent = formattedTotal;

    if (this.progressPrice) {
      var priceLabelEl = this.progressPrice.querySelector(
        ".msf-form__price-label",
      );

      if (priceLabelEl) {
        priceLabelEl.textContent = priceLabel;
      }

      if (shouldFlash) {
        this.progressPrice.classList.remove(
          "msf-form__progress-price--updated",
        );
        void this.progressPrice.offsetWidth;
        this.progressPrice.classList.add("msf-form__progress-price--updated");
      }
    } else {
      priceHost.innerHTML =
        '<span class="msf-form__price-label">' +
        priceLabel +
        "</span>" +
        '<span class="msf-form__price-value">' +
        formattedTotal +
        "</span>";

      if (shouldFlash) {
        priceHost.classList.remove("msf-form__price-bar--updated");
        void priceHost.offsetWidth;
        priceHost.classList.add("msf-form__price-bar--updated");
      }
    }

    this.lastPriceTotal = formattedTotal;
  };

  MSForm.prototype.readQuestionValue = function (question) {
    if (!question || !this.body) {
      return null;
    }

    if (question.type === "checkbox") {
      return Array.prototype.map.call(
        this.body.querySelectorAll('[name="' + question.id + '[]"]:checked'),
        function (input) {
          return input.value;
        },
      );
    }

    if (question.type === "radio") {
      var checked = this.body.querySelector(
        '[name="' + question.id + '"]:checked',
      );
      return checked ? checked.value : "";
    }

    if (question.type === "consent") {
      var consentInput = this.body.querySelector(
        '[name="' + question.id + '"]',
      );
      return consentInput && consentInput.checked ? "1" : "";
    }

    if (question.type === "file") {
      var fileInput = this.body.querySelector('[name="' + question.id + '"]');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        return fileInput.files[0].name;
      }
      return this.fileAnswers[question.id]
        ? this.fileAnswers[question.id].name
        : "";
    }

    var field = this.body.querySelector('[name="' + question.id + '"]');
    return field ? field.value : "";
  };

  MSForm.prototype.getAnswersForPricing = function () {
    var answers = Object.assign({}, this.answers);
    var step = this.getCurrentStep();

    if (
      !step ||
      step.type === "summary" ||
      !step.questions ||
      !step.questions[0]
    ) {
      return answers;
    }

    var question = step.questions[0];
    var currentValue = this.readQuestionValue(question);

    if (currentValue !== null && currentValue !== "") {
      answers[question.id] = currentValue;
    }

    return answers;
  };

  MSForm.prototype.renderPriceBreakdown = function (result) {
    var wrap = el("div", { className: "msf-form__price-breakdown" });
    var list = el("ul", { className: "msf-form__price-lines" });

    (result.lines || []).forEach(function (line) {
      list.appendChild(
        el("li", {
          className: "msf-form__price-line",
          html:
            "<span>" +
            line.label +
            "</span><span>" +
            formatMoney(line.amount, result.currency) +
            "</span>",
        }),
      );
    });

    wrap.appendChild(list);
    wrap.appendChild(
      el("p", {
        className: "msf-form__price-total",
        html:
          "<strong>" +
          (this.i18n.total || "Kopā") +
          ":</strong> " +
          formatMoney(result.total, result.currency),
      }),
    );

    return wrap;
  };

  MSForm.prototype.getAnswerDisplay = function (question, value) {
    if (question.type === "checkbox" && Array.isArray(value)) {
      return value
        .map(function (selected) {
          var option = (question.options || []).find(function (opt) {
            return opt.value === selected;
          });
          return option ? option.label : selected;
        })
        .join(", ");
    }

    if (question.type === "radio") {
      var match = (question.options || []).find(function (opt) {
        return opt.value === value;
      });
      return match ? match.label : String(value);
    }

    if (question.type === "file") {
      if (this.fileAnswers[question.id]) {
        return this.fileAnswers[question.id].name;
      }
      return value ? String(value) : "";
    }

    if (question.type === "consent") {
      return value === "1" || value === 1 || value === true
        ? this.i18n.consentAccepted || "Piekrīts"
        : "";
    }

    if (question.type === "date" && value) {
      var parts = String(value).split("-");
      if (parts.length === 3) {
        return parts[2] + "/" + parts[1] + "/" + parts[0];
      }
    }

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    return String(value || "");
  };

  MSForm.prototype.renderSummary = function (panel) {
    var settings = this.config.settings || {};
    var title =
      settings.summaryTitle || this.i18n.summaryTitle || "Kopsavilkums";

    panel.appendChild(
      el("h3", { className: "msf-form__step-title", text: title }),
    );
    panel.appendChild(
      el("p", {
        className: "msf-form__summary-intro",
        text: this.i18n.yourAnswers || "Jūsu atbildes",
      }),
    );

    var list = el("dl", { className: "msf-form__summary-list" });

    getVisibleSteps(this.config.steps, this.answers).forEach(
      function (step) {
        if (!step.questions || !step.questions[0] || step.type === "summary") {
          return;
        }

        var question = step.questions[0];
        var value = this.answers[question.id];

        if (value === undefined || value === null || value === "") {
          return;
        }

        list.appendChild(el("dt", { text: question.label }));
        list.appendChild(
          el("dd", { text: this.getAnswerDisplay(question, value) }),
        );
      }.bind(this),
    );

    panel.appendChild(list);

    var pricing = this.config.pricing || {};

    if (pricing.enabled) {
      panel.appendChild(
        this.renderPriceBreakdown(calculatePricing(this.config, this.answers)),
      );
    }
  };

  MSForm.prototype.destroyDatePickers = function () {
    if (!this.datePickers || !this.datePickers.length) {
      this.datePickers = [];
      return;
    }

    this.datePickers.forEach(function (picker) {
      if (picker && typeof picker.destroy === "function") {
        picker.destroy();
      }
    });
    this.datePickers = [];
  };

  MSForm.prototype.formatDateValue = function (date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
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
    var input = fieldWrap.querySelector(".msf-form__date-input");

    if (!input) {
      return;
    }

    var shortcuts = [
      {
        key: "week",
        getDate: function () {
          return self.addDays(new Date(), 7);
        },
      },
      {
        key: "month",
        getDate: function () {
          return self.addMonths(new Date(), 1);
        },
      },
      {
        key: "quarter",
        getDate: function () {
          return self.addMonths(new Date(), 3);
        },
      },
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

    fieldWrap
      .querySelectorAll("[data-msf-date-shortcut]")
      .forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          var key = button.getAttribute("data-msf-date-shortcut");
          var shortcut = shortcuts.find(function (item) {
            return item.key === key;
          });

          if (shortcut) {
            applyDate(shortcut.getDate());
          }
        });
      });

    if (typeof window.flatpickr !== "function") {
      input.placeholder = self.i18n.datePlaceholder || "dd/mm/yyyy";
      return;
    }

    var locale =
      window.flatpickr.l10ns && window.flatpickr.l10ns.lv
        ? window.flatpickr.l10ns.lv
        : undefined;
    var picker = window.flatpickr(input, {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      altInputClass: "msf-form__input",
      locale: locale,
      minDate: "today",
      allowInput: true,
      defaultDate: input.value || null,
      onChange: function (selectedDates, dateStr) {
        if (dateStr) {
          self.answers[question.id] = dateStr;
          self.updatePriceBar();
        }
      },
    });

    this.datePickers.push(picker);
  };

  MSForm.prototype.clearBodyMinHeight = function () {
    this.bodyQuestionMinHeight = 0;

    if (this.body) {
      this.body.style.minHeight = "";
    }
  };

  MSForm.prototype.getQuestionStepsForMeasure = function () {
    return getVisibleSteps(this.config.steps, this.answers).filter(
      function (step) {
        return step.type !== "summary";
      },
    );
  };

  MSForm.prototype.measureStepPanelHeight = function (panel) {
    this.body.appendChild(panel);
    var height = panel.offsetHeight;
    this.body.removeChild(panel);
    return height;
  };

  MSForm.prototype.precomputeBodyMinHeight = function () {
    if (
      !this.body ||
      !this.config ||
      !this.config.steps ||
      !this.config.steps.length
    ) {
      return;
    }

    var questionSteps = this.getQuestionStepsForMeasure();
    var max = 0;
    var self = this;

    questionSteps.forEach(function (step, index) {
      var panel = self.buildStepPanel(step, {
        showBack: index > 0,
        isLast: false,
        interactive: false,
      });

      max = Math.max(max, self.measureStepPanelHeight(panel));
    });

    this.bodyQuestionMinHeight = max;

    if (max > 0) {
      this.body.style.minHeight = max + "px";
    }
  };

  MSForm.prototype.applyStepBodyHeight = function (panel, step) {
    if (!this.body || !panel) {
      return;
    }

    if (
      step &&
      step.type !== "summary" &&
      panel.offsetHeight > (this.bodyQuestionMinHeight || 0)
    ) {
      this.bodyQuestionMinHeight = panel.offsetHeight;
    }

    var height = this.bodyQuestionMinHeight || panel.offsetHeight;

    if (step && step.type === "summary") {
      height = Math.max(height, panel.offsetHeight);
    }

    if (height > 0) {
      this.body.style.minHeight = height + "px";
    }
  };

  MSForm.prototype.buildStepPanel = function (step, options) {
    options = options || {};
    var showBack = !!options.showBack;
    var isLast = !!options.isLast;
    var interactive = options.interactive !== false;
    var settings = this.config.settings || {};

    var panelAttrs = { className: "msf-form__step" };

    if (interactive) {
      panelAttrs.role = "group";
      panelAttrs["aria-live"] = "polite";
    }

    var panel = el("div", panelAttrs);

    if (step.type === "summary") {
      this.renderSummary(panel);
    } else if (step.questions && step.questions[0]) {
      var question = step.questions[0];
      var useFieldset =
        question.type === "radio" ||
        question.type === "checkbox" ||
        question.type === "consent";
      var titleMatchesLabel = !!(
        step.title &&
        question.label &&
        step.title.trim() === question.label.trim()
      );
      var primaryTitle = "";

      if (step.title) {
        primaryTitle = step.title;
      } else if (question.label && !useFieldset) {
        primaryTitle = question.label;
      }

      if (primaryTitle) {
        var stepTitleId = interactive
          ? this.fieldInputId(step.id, "title")
          : "";
        var titleAttrs = {
          className: "msf-form__step-title",
          text: primaryTitle,
        };

        if (stepTitleId) {
          titleAttrs.id = stepTitleId;
        }

        panel.appendChild(el("h3", titleAttrs));

        if (stepTitleId) {
          panel.setAttribute("aria-labelledby", stepTitleId);
        }
      }

      if (step.description) {
        panel.appendChild(
          el("p", {
            className: "msf-form__step-description",
            text: step.description,
          }),
        );
      }

      var numberExamples =
        question.type === "number" ? this.getNumberExampleValues(question) : [];

      if (question.description && !numberExamples.length) {
        panel.appendChild(
          el("p", {
            className: "msf-form__question-description",
            text: question.description,
          }),
        );
      }

      var fieldWrap = this.renderField(question, {
        headingShown: !!primaryTitle,
      });
      var showSecondaryLabel =
        !useFieldset && step.title && question.label && !titleMatchesLabel;

      if (useFieldset) {
        var fieldset = el("fieldset", { className: "msf-form__fieldset" });

        if (question.type === "consent") {
          fieldset.setAttribute(
            "aria-label",
            question.consentText || question.label || "",
          );
        } else {
          fieldset.appendChild(
            el("legend", {
              className: "msf-form__label",
              text: question.label,
            }),
          );
        }

        fieldset.appendChild(fieldWrap);
        panel.appendChild(fieldset);
      } else if (showSecondaryLabel) {
        panel.appendChild(
          el("label", {
            className: "msf-form__label",
            for: this.fieldInputId(question.id),
            text: question.label,
          }),
        );
        panel.appendChild(fieldWrap);
      } else {
        panel.appendChild(fieldWrap);
      }

      if (interactive && !primaryTitle && question.label) {
        panel.setAttribute("aria-label", question.label);
      }

      panel._msfFieldWrap = fieldWrap;
      panel._msfQuestion = question;
    }

    var actions = el("div", { className: "msf-form__actions" });

    if (showBack) {
      actions.appendChild(
        el("button", {
          type: "button",
          className: "msf-form__btn msf-form__btn--secondary",
          text: settings.backLabel || "Atpakaļ",
        }),
      );
    }

    actions.appendChild(
      el("button", {
        type: "button",
        className: "msf-form__btn msf-form__btn--primary",
        text: isLast
          ? settings.submitLabel || "Nosūtīt"
          : settings.nextLabel || "Tālāk",
      }),
    );

    panel.appendChild(actions);

    return panel;
  };

  MSForm.prototype.renderStep = function () {
    var step = this.getCurrentStep();
    var self = this;
    var transitionMs = this.getTransitionMs();

    if (!step) {
      this.body.innerHTML = "";
      return;
    }

    this.destroyDatePickers();
    this.body.innerHTML = "";
    this.updateProgress();
    this.updatePriceBar();

    var steps = this.getVisibleSteps();
    var currentIndex = steps.findIndex(function (item) {
      return item.id === step.id;
    });
    var isLast = currentIndex >= steps.length - 1;
    var panel = this.buildStepPanel(step, {
      showBack: this.history.length > 0,
      isLast: isLast,
      interactive: true,
    });

    panel.classList.add("msf-form__step--enter");

    if (this.history.length === 0) {
      panel.classList.add("msf-form__step--intro");
    }

    var activeFieldWrap = panel._msfFieldWrap || null;
    var activeQuestion = panel._msfQuestion || null;

    delete panel._msfFieldWrap;
    delete panel._msfQuestion;

    var actions = panel.querySelector(".msf-form__actions");
    var backBtn = actions
      ? actions.querySelector(".msf-form__btn--secondary")
      : null;

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        self.goBack();
      });
    }

    var question =
      step.type === "summary" ? null : step.questions && step.questions[0];
    var nextBtn = actions
      ? actions.querySelector(".msf-form__btn--primary")
      : null;

    if (
      activeQuestion &&
      activeFieldWrap &&
      this.config.pricing &&
      this.config.pricing.enabled
    ) {
      activeFieldWrap.addEventListener("input", function () {
        self.updatePriceBar();
      });
      activeFieldWrap.addEventListener("change", function () {
        self.updatePriceBar();
      });
    }

    if (nextBtn) {
      nextBtn.classList.add(
        isLast ? "msf-form__btn--submit" : "msf-form__btn--next",
      );

      nextBtn.addEventListener("click", function () {
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
    }

    this.body.appendChild(panel);
    this.applyStepBodyHeight(panel, step);

    if (activeQuestion && activeQuestion.type === "date" && activeFieldWrap) {
      this.initDateField(activeFieldWrap, activeQuestion);
      this.applyStepBodyHeight(panel, step);
    }

    if (activeQuestion && activeQuestion.type === "number" && activeFieldWrap) {
      this.initNumberField(activeFieldWrap, activeQuestion);
    }

    window.setTimeout(function () {
      panel.classList.remove("msf-form__step--enter");
    }, 20);

    if (step.interval && step.interval.afterPreviousMs) {
      window.setTimeout(
        function () {
          panel.classList.add("msf-form__step--ready");
        },
        parseInt(step.interval.afterPreviousMs, 10) || 0,
      );
    } else {
      panel.classList.add("msf-form__step--ready");
    }

    panel.style.setProperty("--msf-transition-ms", transitionMs + "ms");

    if (
      activeQuestion &&
      ["text", "number", "email", "tel", "textarea"].indexOf(
        activeQuestion.type,
      ) !== -1
    ) {
      window.setTimeout(function () {
        var focusTarget = self.getQuestionControl(activeQuestion);

        if (focusTarget && typeof focusTarget.focus === "function") {
          try {
            focusTarget.focus({ preventScroll: true });
          } catch (error) {
            focusTarget.focus();
          }
        }
      }, transitionMs + 40);
    }
  };

  MSForm.prototype.isGuestCountQuestion = function (question) {
    var id = String(question.id || "").toLowerCase();
    var label = String(question.label || "").toLowerCase();

    return id.indexOf("guest") !== -1 || label.indexOf("vies") !== -1;
  };

  MSForm.prototype.getNumberPlaceholder = function (question, fieldOptions) {
    fieldOptions = fieldOptions || {};
    var configured = question.placeholder
      ? String(question.placeholder).trim()
      : "";

    if (configured) {
      if (/^\d+(\.\d+)?$/.test(configured)) {
        return configured;
      }

      if (fieldOptions.headingShown) {
        return "";
      }

      return configured;
    }

    if (fieldOptions.headingShown) {
      return "";
    }

    if (this.isGuestCountQuestion(question)) {
      return this.i18n.numberGuestPlaceholder || "80";
    }

    return this.i18n.numberPlaceholder || "piemēram, 80";
  };

  MSForm.prototype.getNumberExampleValues = function (question) {
    var validation = question.validation || {};
    var min = parseInt(validation.min, 10);
    var max = parseInt(validation.max, 10);
    var candidates = [];

    if (
      Array.isArray(question.numberExamples) &&
      question.numberExamples.length
    ) {
      candidates = question.numberExamples
        .map(function (value) {
          return parseFloat(value);
        })
        .filter(function (value) {
          return !isNaN(value);
        });
    } else if (this.isGuestCountQuestion(question)) {
      candidates = [50, 80, 100, 150];
    }

    return candidates.filter(function (value) {
      if (!isNaN(min) && value < min) {
        return false;
      }

      if (!isNaN(max) && value > max) {
        return false;
      }

      return true;
    });
  };

  MSForm.prototype.getNumberHint = function (question) {
    var validation = question.validation || {};
    var min = parseInt(validation.min, 10);
    var max = parseInt(validation.max, 10);

    if (isNaN(min) || isNaN(max)) {
      return "";
    }

    if (this.isGuestCountQuestion(question)) {
      var example =
        question.placeholder || this.i18n.numberGuestPlaceholder || "80";

      return (
        this.i18n.numberRangeExample ||
        "piemēram, %example% · no %min% līdz %max%"
      )
        .replace("%example%", example + " viesi")
        .replace("%min%", String(min))
        .replace("%max%", String(max));
    }

    return (this.i18n.numberRange || "No %min% līdz %max%")
      .replace("%min%", String(min))
      .replace("%max%", String(max));
  };

  MSForm.prototype.getNumberStep = function (question) {
    var validation = question.validation || {};
    var step = parseInt(validation.step, 10);

    if (!isNaN(step) && step > 0) {
      return step;
    }

    var max = parseInt(validation.max, 10);

    if (!isNaN(max) && max >= 100) {
      return 5;
    }

    return 1;
  };

  MSForm.prototype.initNumberField = function (wrap, question) {
    var input = wrap.querySelector('input[type="number"]');
    var buttons = wrap.querySelectorAll("[data-msf-number-step]");
    var validation = question.validation || {};
    var min = parseInt(validation.min, 10);
    var max = parseInt(validation.max, 10);
    var step = this.getNumberStep(question);
    var self = this;

    if (!input || !buttons.length) {
      return;
    }

    function clampValue(raw) {
      var value = parseInt(raw, 10);

      if (isNaN(value)) {
        return !isNaN(min) ? min : 0;
      }

      if (!isNaN(min)) {
        value = Math.max(min, value);
      }

      if (!isNaN(max)) {
        value = Math.min(max, value);
      }

      return value;
    }

    function setValue(nextValue) {
      input.value = String(clampValue(nextValue));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var direction =
          parseInt(button.getAttribute("data-msf-number-step"), 10) || 0;
        var current = parseInt(input.value, 10);

        if (isNaN(current)) {
          current = !isNaN(min) ? min : 0;
        }

        setValue(current + direction * step);
      });
    });

    input.addEventListener("blur", function () {
      if (String(input.value || "").trim() === "") {
        return;
      }

      setValue(input.value);
    });

    wrap.querySelectorAll("[data-msf-number-value]").forEach(function (button) {
      button.addEventListener("click", function () {
        setValue(button.getAttribute("data-msf-number-value"));
        input.focus();
      });
    });
  };

  MSForm.prototype.goNext = function (currentStep) {
    this.history.push(currentStep.id);

    var steps = this.getVisibleSteps();
    var currentIndex = steps.findIndex(function (step) {
      return step.id === currentStep.id;
    });
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

  MSForm.prototype.renderField = function (question, fieldOptions) {
    fieldOptions = fieldOptions || {};
    var wrap = el("div", { className: "msf-form__field" });
    var value = this.answers[question.id];
    var inputId = this.fieldInputId(question.id);
    var self = this;

    switch (question.type) {
      case "textarea":
        wrap.appendChild(
          el("textarea", {
            className: "msf-form__input",
            id: inputId,
            name: question.id,
            rows: "4",
          }),
        );
        wrap.querySelector("textarea").value = value || "";
        break;
      case "number":
        var numberValidation = question.validation || {};
        var numberMin = parseInt(numberValidation.min, 10);
        var numberMax = parseInt(numberValidation.max, 10);
        var numberAttrs = {
          className: "msf-form__input msf-form__input--number",
          id: inputId,
          type: "number",
          name: question.id,
          inputmode: "numeric",
          placeholder: this.getNumberPlaceholder(question, fieldOptions),
        };

        if (!isNaN(numberMin)) {
          numberAttrs.min = String(numberMin);
        }

        if (!isNaN(numberMax)) {
          numberAttrs.max = String(numberMax);
        }

        var numberControl = el("div", { className: "msf-form__number" });
        numberControl.appendChild(
          el("button", {
            type: "button",
            className: "msf-form__number-btn",
            "data-msf-number-step": "-1",
            "aria-label": this.i18n.numberDecrease || "Samazināt",
            text: "−",
          }),
        );
        numberControl.appendChild(el("input", numberAttrs));
        numberControl.appendChild(
          el("button", {
            type: "button",
            className: "msf-form__number-btn",
            "data-msf-number-step": "1",
            "aria-label": this.i18n.numberIncrease || "Palielināt",
            text: "+",
          }),
        );
        wrap.appendChild(numberControl);

        var exampleValues = this.getNumberExampleValues(question);
        var numberHint = exampleValues.length
          ? ""
          : this.getNumberHint(question);

        if (numberHint) {
          wrap.appendChild(
            el("p", {
              className: "msf-form__field-hint",
              text: numberHint,
            }),
          );
        }

        if (exampleValues.length) {
          var examplesWrap = el("div", {
            className: "msf-form__number-examples",
          });
          var examplesLabel =
            this.i18n.numberExamplesLabel || "Populāri varianti";

          examplesWrap.appendChild(
            el("p", {
              className: "msf-form__number-examples-label",
              text: examplesLabel,
            }),
          );

          var exampleButtons = el("div", {
            className: "msf-form__number-example-list",
            role: "group",
            "aria-label": examplesLabel,
          });

          exampleValues.forEach(function (exampleValue) {
            exampleButtons.appendChild(
              el("button", {
                type: "button",
                className:
                  "msf-form__quick-pick msf-form__number-example",
                "data-msf-number-value": String(exampleValue),
                text: String(exampleValue),
              }),
            );
          });

          examplesWrap.appendChild(exampleButtons);
          wrap.appendChild(examplesWrap);
        }

        if (value !== undefined) {
          wrap.querySelector("input").value = value;
        }
        break;
      case "email":
        wrap.appendChild(
          el("input", {
            className: "msf-form__input",
            id: inputId,
            type: "email",
            name: question.id,
            inputmode: "email",
            autocomplete: "email",
          }),
        );
        wrap.querySelector("input").value = value || "";
        break;
      case "tel":
        wrap.appendChild(
          el("input", {
            className: "msf-form__input",
            id: inputId,
            type: "tel",
            name: question.id,
            inputmode: "tel",
            autocomplete: "tel",
          }),
        );
        wrap.querySelector("input").value = value || "";
        break;
      case "radio":
        wrap.classList.add("msf-form__choices");
        (question.options || []).forEach(function (option) {
          var optionInputId = self.fieldInputId(question.id, option.value);
          var label = el("label", {
            className: "msf-form__choice",
            html:
              '<input type="radio" id="' +
              optionInputId +
              '" name="' +
              question.id +
              '" value="' +
              option.value +
              '"><span class="msf-form__choice-control" aria-hidden="true"></span><span class="msf-form__choice-text">' +
              option.label +
              "</span>",
          });
          if (value === option.value) {
            label.querySelector("input").checked = true;
          }
          wrap.appendChild(label);
        });
        break;
      case "checkbox":
        wrap.classList.add("msf-form__choices");
        (question.options || []).forEach(function (option) {
          var optionInputId = self.fieldInputId(question.id, option.value);
          var label = el("label", {
            className: "msf-form__choice",
            html:
              '<input type="checkbox" id="' +
              optionInputId +
              '" name="' +
              question.id +
              '[]" value="' +
              option.value +
              '"><span class="msf-form__choice-control" aria-hidden="true"></span><span class="msf-form__choice-text">' +
              option.label +
              "</span>",
          });
          if (Array.isArray(value) && value.indexOf(option.value) !== -1) {
            label.querySelector("input").checked = true;
          }
          wrap.appendChild(label);
        });
        break;
      case "date":
        var dateField = el("div", { className: "msf-form__date-field" });
        var pickerWrap = el("div", { className: "msf-form__date-picker-wrap" });
        var dateInput = el("input", {
          className: "msf-form__input msf-form__date-input",
          id: inputId,
          type: "text",
          name: question.id,
          autocomplete: "off",
          placeholder: this.i18n.datePlaceholder || "dd/mm/yyyy",
        });
        var shortcutLabels = [
          ["week", this.i18n.dateAfterWeek || "Pēc nedēļas"],
          ["month", this.i18n.dateAfterMonth || "Pēc mēneša"],
          ["quarter", this.i18n.dateAfterThreeMonths || "Pēc 3 mēnešiem"],
        ];
        var dateExamplesLabel =
          this.i18n.dateExamplesLabel
          || this.i18n.numberExamplesLabel
          || "Populāri varianti";
        var dateExamplesWrap = el("div", {
          className: "msf-form__number-examples msf-form__date-examples",
        });
        var dateExampleList = el("div", {
          className: "msf-form__number-example-list",
          role: "group",
          "aria-label": dateExamplesLabel,
        });

        dateInput.value = value || "";
        pickerWrap.appendChild(dateInput);
        dateField.appendChild(pickerWrap);

        dateExamplesWrap.appendChild(
          el("p", {
            className: "msf-form__number-examples-label",
            text: dateExamplesLabel,
          }),
        );

        shortcutLabels.forEach(function (item) {
          dateExampleList.appendChild(
            el("button", {
              type: "button",
              className:
                "msf-form__quick-pick msf-form__number-example msf-form__date-shortcut",
              "data-msf-date-shortcut": item[0],
              text: item[1],
            }),
          );
        });

        dateExamplesWrap.appendChild(dateExampleList);
        dateField.appendChild(dateExamplesWrap);
        wrap.appendChild(dateField);
        break;
      case "file":
        var maxMb =
          question.validation && question.validation.maxSizeMb
            ? question.validation.maxSizeMb
            : 5;
        var fileInput = el("input", {
          className: "msf-form__input",
          id: inputId,
          type: "file",
          name: question.id,
          accept: ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx",
        });
        wrap.appendChild(fileInput);
        wrap.appendChild(
          el("p", {
            className: "msf-form__field-hint",
            text: (
              this.i18n.fileHint || "Maks. %s MB (JPG, PNG, PDF, DOC)"
            ).replace("%s", String(maxMb)),
          }),
        );
        if (this.fileAnswers[question.id]) {
          wrap.appendChild(
            el("p", {
              className: "msf-form__file-selected",
              text: this.fileAnswers[question.id].name,
            }),
          );
        }
        break;
      case "consent":
        var consentHtml = question.consentText || question.label || "";
        if (question.consentLinkUrl) {
          consentHtml +=
            ' <a href="' +
            question.consentLinkUrl +
            '" target="_blank" rel="noopener noreferrer">' +
            (question.consentLinkLabel || question.consentLinkUrl) +
            "</a>";
        }
        var consentLabel = el("label", {
          className: "msf-form__choice msf-form__consent",
          html:
            '<input type="checkbox" id="' +
            inputId +
            '" name="' +
            question.id +
            '" value="1"> ' +
            consentHtml,
        });
        if (value === "1" || value === 1 || value === true) {
          consentLabel.querySelector("input").checked = true;
        }
        wrap.appendChild(consentLabel);
        break;
      default: {
        var contactFormat = getContactFormat(question);
        var inputType = "text";
        var inputAttrs = {
          className: "msf-form__input",
          id: inputId,
          type: inputType,
          name: question.id,
        };

        if (contactFormat === "email") {
          inputAttrs.type = "email";
          inputAttrs.inputmode = "email";
          inputAttrs.autocomplete = "email";
        } else if (contactFormat === "phone") {
          inputAttrs.type = "tel";
          inputAttrs.inputmode = "tel";
          inputAttrs.autocomplete = "tel";
        }

        wrap.appendChild(el("input", inputAttrs));
        wrap.querySelector("input").value = value || "";
        break;
      }
    }

    return wrap;
  };

  MSForm.prototype.showFieldError = function (message, question) {
    var step = this.body.querySelector(".msf-form__step");
    var errorId = question ? this.fieldErrorId(question.id) : "";
    var errorEl = el("p", {
      className: "msf-form__error",
      id: errorId,
      role: "alert",
      tabindex: "-1",
      text: message,
    });
    var focusTarget = null;

    if (step) {
      var actions = step.querySelector(".msf-form__actions");

      if (actions) {
        step.insertBefore(errorEl, actions);
      } else {
        step.appendChild(errorEl);
      }

      this.applyStepBodyHeight(step, this.getCurrentStep());
    }

    if (question) {
      focusTarget = this.getQuestionControl(question);

      if (focusTarget) {
        focusTarget.setAttribute("aria-invalid", "true");

        if (errorId) {
          focusTarget.setAttribute("aria-describedby", errorId);
        }
      }
    }

    if (!focusTarget) {
      focusTarget = errorEl;
    }

    focusTarget.focus();
  };

  MSForm.prototype.validateCurrent = function (question) {
    var requiredMessage = this.i18n.required || "Šis lauks ir obligāts.";

    this.clearFieldErrors();

    var contactFormat = getContactFormat(question);

    if (contactFormat) {
      var contactField = this.getQuestionControl(question);
      var contactValue = contactField
        ? String(contactField.value || "").trim()
        : "";

      if (!contactValue) {
        if (!question.required) {
          return true;
        }

        this.showFieldError(requiredMessage, question);
        return false;
      }

      if (contactFormat === "email" && !isValidEmail(contactValue)) {
        this.showFieldError(
          this.i18n.invalidEmail || "Lūdzu, ievadiet derīgu e-pasta adresi.",
          question,
        );
        return false;
      }

      if (contactFormat === "phone" && !isValidPhone(contactValue)) {
        this.showFieldError(
          this.i18n.invalidPhone || "Lūdzu, ievadiet derīgu tālruņa numuru.",
          question,
        );
        return false;
      }

      return true;
    }

    if (question.type === "date") {
      var dateField = this.getQuestionControl(question);
      var dateValue = dateField ? String(dateField.value || "").trim() : "";

      if (!dateValue) {
        if (!question.required) {
          return true;
        }

        this.showFieldError(requiredMessage, question);
        return false;
      }

      if (!isValidIsoDate(dateValue)) {
        this.showFieldError(
          this.i18n.invalidDate || "Lūdzu, ievadiet derīgu datumu.",
          question,
        );
        return false;
      }

      return true;
    }

    if (!question.required) {
      return true;
    }

    var valid = false;

    if (question.type === "checkbox") {
      valid = !!this.body.querySelector(
        '[name="' + question.id + '[]"]:checked',
      );
    } else if (question.type === "radio") {
      valid = !!this.body.querySelector('[name="' + question.id + '"]:checked');
    } else if (question.type === "consent") {
      valid = !!this.body.querySelector('[name="' + question.id + '"]:checked');
    } else if (question.type === "file") {
      var fileField = this.body.querySelector('[name="' + question.id + '"]');
      valid = !!(
        this.fileAnswers[question.id] ||
        (fileField && fileField.files && fileField.files[0])
      );
    } else {
      var field = this.getQuestionControl(question);
      valid = field ? String(field.value || "").trim() !== "" : false;
    }

    if (!valid) {
      this.showFieldError(requiredMessage, question);
    }

    return valid;
  };

  MSForm.prototype.collectCurrent = function (question) {
    if (question.type === "checkbox") {
      this.answers[question.id] = Array.prototype.map.call(
        this.body.querySelectorAll('[name="' + question.id + '[]"]:checked'),
        function (input) {
          return input.value;
        },
      );
      return;
    }

    if (question.type === "radio") {
      var checked = this.body.querySelector(
        '[name="' + question.id + '"]:checked',
      );
      this.answers[question.id] = checked ? checked.value : "";
      return;
    }

    if (question.type === "consent") {
      var consentBox = this.body.querySelector('[name="' + question.id + '"]');
      this.answers[question.id] = consentBox && consentBox.checked ? "1" : "";
      return;
    }

    if (question.type === "file") {
      var fileBox = this.body.querySelector('[name="' + question.id + '"]');
      if (fileBox && fileBox.files && fileBox.files[0]) {
        this.fileAnswers[question.id] = fileBox.files[0];
        this.answers[question.id] = fileBox.files[0].name;
      }
      return;
    }

    var field = this.body.querySelector('[name="' + question.id + '"]');
    this.answers[question.id] = field ? field.value : "";
  };

  MSForm.prototype.setSubmitting = function (
    isSubmitting,
    primaryBtn,
    originalText,
  ) {
    this.isSubmitting = isSubmitting;

    if (!primaryBtn) {
      return;
    }

    primaryBtn.disabled = isSubmitting;

    if (isSubmitting) {
      primaryBtn.setAttribute("aria-busy", "true");
      primaryBtn.textContent = this.i18n.submitting || "Nosūta…";
      return;
    }

    primaryBtn.removeAttribute("aria-busy");
    primaryBtn.textContent = originalText || primaryBtn.textContent;
  };

  MSForm.prototype.showSubmitError = function (message) {
    var step = this.body.querySelector(".msf-form__step");
    var existing = this.body.querySelector(".msf-form__submit-error");

    if (existing) {
      existing.remove();
    }

    var errorEl = el("p", {
      className: "msf-form__error msf-form__submit-error",
      role: "alert",
      tabindex: "-1",
      text: message,
    });

    if (step) {
      var actions = step.querySelector(".msf-form__actions");

      if (actions) {
        step.insertBefore(errorEl, actions);
      } else {
        step.appendChild(errorEl);
      }

      this.applyStepBodyHeight(step, this.getCurrentStep());
    }

    errorEl.focus();
  };

  MSForm.prototype.submit = function (triggerBtn) {
    var self = this;
    var fallbackError =
      this.i18n.error || "Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.";
    var fallbackSuccess =
      this.successMessage || "Paldies! Jūsu pieteikums ir saņemts.";
    var primaryBtn =
      triggerBtn || this.body.querySelector(".msf-form__btn--primary");
    var originalText = primaryBtn ? primaryBtn.textContent : "";

    if (this.isPreview) {
      this.clearBodyMinHeight();
      this.body.innerHTML =
        '<div class="msf-form__success"><p>' +
        (this.i18n.previewSubmit || "Priekšskatījums — nosūtīšana atspējota.") +
        "</p></div>";
      return;
    }

    if (this.isSubmitting) {
      return;
    }

    var existingSubmitError = this.body.querySelector(
      ".msf-form__submit-error",
    );

    if (existingSubmitError) {
      existingSubmitError.remove();
    }

    this.setSubmitting(true, primaryBtn, originalText);

    var data = new FormData();
    data.append("action", "msf_submit_form");
    data.append("nonce", this.nonce);
    data.append("formId", String(this.formId));
    var answersPayload = Object.assign({}, this.answers);
    Object.keys(this.fileAnswers).forEach(function (qid) {
      delete answersPayload[qid];
    });

    data.append("answers", JSON.stringify(answersPayload));
    data.append("pageUrl", this.pageUrl);
    data.append("msf_hp", this.hp ? this.hp.value : "");

    Object.keys(this.fileAnswers).forEach(function (qid) {
      data.append("msf_file_" + qid, self.fileAnswers[qid]);
    });

    fetch(this.ajaxUrl, {
      method: "POST",
      body: data,
      credentials: "same-origin",
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
          self.progressWrap.style.display = "none";
        }

        if (self.priceBar) {
          self.priceBar.hidden = true;
        }

        var message = getPayloadMessage(payload, fallbackSuccess);
        self.clearBodyMinHeight();
        self.body.innerHTML =
          '<div class="msf-form__success"><p>' + message + "</p></div>";
      })
      .catch(function (error) {
        var message = error && error.message ? error.message : fallbackError;

        if (message === "undefined" || !message) {
          message = fallbackError;
        }

        self.setSubmitting(false, primaryBtn, originalText);
        self.showSubmitError(message);
      });
  };

  function initForm(root) {
    if (!root || root.getAttribute("data-msf-initialized") === "1") {
      return null;
    }

    root.setAttribute("data-msf-initialized", "1");
    var instance = new MSForm(root);
    instance.init();
    return instance;
  }

  window.msfInitForm = initForm;

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".msf-form").forEach(function (root) {
      initForm(root);
    });
  });
})();
