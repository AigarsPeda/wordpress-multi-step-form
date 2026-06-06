(function (blocks, element, blockEditor, components, i18n) {
    var el = element.createElement;
    var Fragment = element.Fragment;
    var useBlockProps = blockEditor.useBlockProps;
    var InspectorControls = blockEditor.InspectorControls;
    var PanelBody = components.PanelBody;
    var SelectControl = components.SelectControl;
    var ToggleControl = components.ToggleControl;
    var Placeholder = components.Placeholder;
    var __ = i18n.__;

    function getEditorData() {
        return window.msfBlockEditor || { forms: [], i18n: {} };
    }

    var blockIcon = el(
        'svg',
        {
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: '0 0 24 24',
            width: 24,
            height: 24,
            'aria-hidden': true,
            focusable: false
        },
        el('path', {
            fill: 'currentColor',
            d: 'M4 5.5h6v3H4v-3zm10 0h6v1.5h-6V5.5zM4 10.25h10v1.5H4v-1.5zm12 0h4v1.5h-4v-1.5zM4 15h8v1.5H4V15zm10 0h6v1.5h-6V15zM4 19.5h12v1.5H4v-1.5zm14 0h2v1.5h-2v-1.5z'
        })
    );

    function buildFormOptions(forms, i18nData) {
        return [{ label: i18nData.selectForm || 'Select form', value: 0 }].concat(
            (forms || []).map(function (form) {
                return { label: form.title, value: form.id };
            })
        );
    }

    function FormPicker(props) {
        var editorData = getEditorData();
        var forms = editorData.forms || [];
        var i18nData = editorData.i18n || {};
        var formOptions = buildFormOptions(forms, i18nData);

        if (!forms.length) {
            return el('p', { style: { margin: '12px 0 0', color: '#646970' } }, i18nData.noForms || '');
        }

        return el(
            'div',
            { style: { marginTop: '16px', maxWidth: '320px' } },
            el(SelectControl, {
                label: i18nData.selectForm || __('Select form', 'custom-multi-step-form'),
                value: props.formId || 0,
                options: formOptions,
                onChange: function (value) {
                    props.onChange(parseInt(value, 10) || 0);
                }
            })
        );
    }

    blocks.registerBlockType('custom-msf/form', {
        apiVersion: 2,
        title: __('Multi Step Form', 'custom-multi-step-form'),
        description: __('A configurable multi-step form for many different needs.', 'custom-multi-step-form'),
        icon: blockIcon,
        category: 'widgets',
        keywords: [
            __('multi-step-form', 'custom-multi-step-form'),
            __('form', 'custom-multi-step-form')
        ],
        attributes: {
            formId: { type: 'number', default: 0 },
            showTitle: { type: 'boolean', default: false }
        },
        edit: function (props) {
            var attributes = props.attributes;
            var setAttributes = props.setAttributes;
            var blockProps = useBlockProps({
                className: 'msf-block-editor'
            });
            var editorData = getEditorData();
            var selectedForm = (editorData.forms || []).find(function (f) {
                return f.id === attributes.formId;
            });

            return el(
                Fragment,
                {},
                el(
                    InspectorControls,
                    {},
                    el(
                        PanelBody,
                        { title: __('Form', 'custom-multi-step-form'), initialOpen: true },
                        el(FormPicker, {
                            formId: attributes.formId,
                            onChange: function (formId) {
                                setAttributes({ formId: formId });
                            }
                        }),
                        el(ToggleControl, {
                            label: editorData.i18n.showTitle || __('Show form title', 'custom-multi-step-form'),
                            checked: attributes.showTitle,
                            onChange: function (value) {
                                setAttributes({ showTitle: value });
                            }
                        })
                    )
                ),
                el(
                    'div',
                    blockProps,
                    el(
                        Placeholder,
                        {
                            icon: blockIcon,
                            label: __('Multi Step Form', 'custom-multi-step-form'),
                            instructions: attributes.formId && selectedForm
                                ? (editorData.i18n.selected || __('Selected form:', 'custom-multi-step-form')) + ' ' + selectedForm.title
                                : (editorData.i18n.formRequired || __('Choose a form below:', 'custom-multi-step-form'))
                        },
                        !attributes.formId
                            ? el(FormPicker, {
                                formId: attributes.formId,
                                onChange: function (formId) {
                                    setAttributes({ formId: formId });
                                }
                            })
                            : el(
                                'div',
                                { style: { marginTop: '12px' } },
                                el('p', { style: { margin: '0 0 12px', fontWeight: '600' } }, selectedForm ? selectedForm.title : ''),
                                el(FormPicker, {
                                    formId: attributes.formId,
                                    onChange: function (formId) {
                                        setAttributes({ formId: formId });
                                    }
                                })
                            ),
                        el('p', {
                            style: { margin: '16px 0 0', fontSize: '12px', color: '#646970' }
                        }, editorData.i18n.openSettings || '')
                    )
                )
            );
        },
        save: function () {
            return null;
        }
    });
})(
    window.wp.blocks,
    window.wp.element,
    window.wp.blockEditor,
    window.wp.components,
    window.wp.i18n
);
