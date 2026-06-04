(function (blocks, element, blockEditor, components, i18n) {
    var el = element.createElement;
    var useBlockProps = blockEditor.useBlockProps;
    var Placeholder = components.Placeholder;
    var __ = i18n.__;

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

    blocks.registerBlockType('custom-msf/form', {
        apiVersion: 2,
        title: __('Multi Step Form', 'custom-multi-step-form'),
        description: __('A configurable multi-step form for many different needs.', 'custom-multi-step-form'),
        icon: blockIcon,
        category: 'widgets',
        keywords: [
            __('multi-step-form', 'custom-multi-step-form'),
            __('multi', 'custom-multi-step-form'),
            __('step', 'custom-multi-step-form'),
            __('form', 'custom-multi-step-form')
        ],
        supports: {
            html: false
        },
        edit: function () {
            var blockProps = useBlockProps({
                className: 'custom-multi-step-form-editor'
            });

            return el(
                Placeholder,
                Object.assign({}, blockProps, {
                    icon: blockIcon,
                    label: __('Multi Step Form', 'custom-multi-step-form'),
                    instructions: __('A configurable multi-step form for many different needs. Step and field settings will be added here.', 'custom-multi-step-form')
                }),
                el('p', { style: { margin: 0, color: '#646970', fontSize: '13px' } }, __('Preview placeholder — Hello World on the published page for now.', 'custom-multi-step-form'))
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
