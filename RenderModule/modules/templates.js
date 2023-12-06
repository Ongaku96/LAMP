function setup(tag, template, options) {
    if (globalThis.my_components == null)
        globalThis.my_components = [];
    my_components.push({ name: tag, template: template, options: options });
}
function style(css) {
    let style = new CSSStyleSheet();
    style.replaceSync(css);
    document.adoptedStyleSheets.push(style);
}
export { setup as setupComponent, style as styleComponent };
