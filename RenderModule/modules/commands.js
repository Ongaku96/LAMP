import { vNode } from "./virtualizer.js";
import { Support } from "./library.js";
import { elaborateContent, react, ref } from "./reactive.js";
import { Collection } from "./enumerators.js";
import log from "./console.js";
import EventHandler from "./events.js";
class Command {
    _attribute;
    _handler = new EventHandler();
    get handler() { return this._handler; }
    get attribute() { return this._attribute; }
    constructor(attribute) {
        this._attribute = attribute;
    }
    render(node) {
        throw new Error("Method not implemented. " + node.id);
    }
    accept(options) {
        throw new Error("Method not implemented. " + options.nodename);
    }
}
class CommandVisitor {
    node;
    constructor(node) {
        this.node = node;
    }
    /**Setup Model Command */
    visitModel(command) {
        let _me = this;
        let _input = ["INPUT", "TEXTAREA", "SELECT"];
        try {
            this.setupEvents(command);
            if (this.node.reference.length && _input.includes(this.node.nodeName)) {
                this.node.reference[0].addEventListener("input", function () {
                    command.updateDataSet(_me.node);
                });
            }
            command.accept({
                attribute: "",
                modifiers: [],
                value: command.attribute?.value,
                nodename: this.node.nodeName
            });
            if (command.attribute && this.node.reference[0].nodeType == Node.ELEMENT_NODE)
                this.node.reference[0].removeAttribute(command.attribute.name);
        }
        catch (ex) {
            log(ex, Collection.message_type.error);
        }
    }
    /**Setup On Command */
    visitOn(command) {
        try {
            this.setupEvents(command);
            let _formatted_attribute = command.attribute?.name.includes(cOn.key) ? command.attribute.name : command.attribute?.name.replace("@", cOn.key + ":");
            command.accept({
                attribute: this.readAttribute(_formatted_attribute),
                modifiers: this.readModifiers(_formatted_attribute),
                value: command.attribute?.value,
                nodename: this.node.nodeName
            });
            if (command.attribute?.name && this.node.reference[0].nodeType == Node.ELEMENT_NODE)
                this.node.reference[0].removeAttribute(command.attribute?.name);
        }
        catch (ex) {
            log(ex, Collection.message_type.error);
        }
    }
    /**Setup For Command */
    visitFor(command) {
        try {
            this.setupEvents(command);
            let _template = this.node.backup.cloneNode(true);
            _template.removeAttribute(cFor.key);
            _template.removeAttribute(cFor.filter_key);
            _template.removeAttribute(cFor.sort_key);
            let _options = {
                attribute: "",
                modifiers: [],
                nodename: this.node.nodeName,
                value: command.attribute?.value,
                others: {
                    filter: this.node.element?.getAttribute(cFor.filter_key),
                    sort: this.node.element?.getAttribute(cFor.sort_key),
                    template: _template.outerHTML
                }
            };
            command.accept(_options);
        }
        catch (ex) {
            log(ex, Collection.message_type.error);
        }
    }
    /**Setup Bind Command */
    visitBind(command) {
        try {
            this.setupEvents(command);
            let _formatted_attribute = command.attribute?.name.includes(cBind.key) ? command.attribute?.name : command.attribute?.name.replace(":", cBind.key + ":");
            command.accept({
                attribute: this.readAttribute(_formatted_attribute),
                modifiers: [],
                value: command.attribute?.value,
                nodename: this.node.nodeName
            });
            if (command.attribute?.name && this.node.reference[0].nodeType == Node.ELEMENT_NODE)
                this.node.reference[0].removeAttribute(command.attribute?.name);
        }
        catch (ex) {
            log(ex, Collection.message_type.error);
        }
    }
    /**Setup Conditional Rendering Command */
    visitIf(command) {
        try {
            this.setupEvents(command);
            command.accept({
                attribute: "",
                modifiers: [],
                value: null,
                nodename: this.node.nodeName,
                others: elab(this.node.element, this.node.reference[0])
            });
        }
        catch (ex) {
            log(ex, Collection.message_type.error);
        }
        /**Elaborate conditional view set of instructions, it needs the original node backup for if in case of template (because of node replacement)
         * and the actual node reference for checking sibling  */
        function elab(node, reference) {
            let _block = [];
            let _conditional = getConditionalBlock(node);
            if (_conditional)
                _block.push(_conditional);
            let _sibling = reference?.nextElementSibling;
            while (_sibling != null && !(_sibling.getAttributeNames().includes(cIf.key))) {
                let _conditional = getConditionalBlock(_sibling);
                if (_conditional)
                    _block.push(_conditional);
                _sibling = goAhead(_sibling, _conditional != null);
            }
            return _block;
            /**Get Conditional View set based on attribute conditions */
            function getConditionalBlock(sibling) {
                if (sibling) {
                    //Check IF
                    if (sibling.getAttributeNames().includes(cIf.key)) {
                        let _condition = function (context) {
                            let _condition = sibling.getAttribute(cIf.key);
                            if (_condition) {
                                let _elab = elaborateContent(_condition, context);
                                return checkValue(_elab);
                            }
                            return false;
                        };
                        let _template = sibling.cloneNode(true);
                        _template.removeAttribute(cIf.key);
                        return {
                            template: _template,
                            condition: _condition
                        };
                    }
                    //Check ELSEIF
                    if (sibling.getAttributeNames().includes(cIf.key_elseif)) {
                        let _condition = function (context) {
                            let _condition = sibling.getAttribute(cIf.key_elseif);
                            if (_condition) {
                                let _elab = elaborateContent(_condition, context);
                                return checkValue(_elab);
                            }
                            return false;
                        };
                        let _template = sibling.virtual?.backup.cloneNode(true);
                        _template.removeAttribute(cIf.key_elseif);
                        return {
                            template: _template,
                            condition: _condition
                        };
                    }
                    //Check ELSE
                    if (sibling.getAttributeNames().includes(cIf.key_else)) {
                        let _template = sibling.virtual?.backup.cloneNode(true);
                        _template.removeAttribute(cIf.key_else);
                        return {
                            template: _template,
                            condition: function () { return true; }
                        };
                    }
                }
                return null;
                function checkValue(value) {
                    if (typeof value == "boolean")
                        return value;
                    else
                        return value != null;
                }
            }
            /**Get next sibling and remove previous if was a part of conditional block */
            function goAhead(sibling, remove) {
                if (sibling != null) {
                    let _temp = sibling.nextElementSibling;
                    if (remove)
                        sibling.remove();
                    return _temp;
                }
                return null;
            }
        }
    }
    setupEvents(command) {
        command.handler.on(Collection.node_event.setup, async (output) => {
            if (Support.debug(this.node.settings, Collection.debug_mode.command))
                log({ command: this.node.id + " - " + command.constructor.name.toUpperCase(), event: "SETUP", node: this, data: output }, Collection.message_type.debug);
        });
        command.handler.on(Collection.node_event.render, async (output) => {
            if (Support.debug(this.node.settings, Collection.debug_mode.command))
                log({ command: this.node.id + " - " + command.constructor.name.toUpperCase(), event: "RENDER", node: this, data: output }, Collection.message_type.debug);
        });
    }
    readAttribute(param) {
        let _on = param ? param?.split(":") : [];
        if (_on.length > 0) {
            return _on[1].split(".")[0];
        }
        return "";
    }
    readModifiers(param) {
        let _on = param ? param.split(":") : [];
        if (_on.length > 0) {
            return _on[1].split(".")?.subarray(1);
        }
        return [];
    }
}
class cModel extends Command {
    static key = "cmd-model";
    static regexp = /(CMD-MODEL)|(cmd-model)/gm;
    /**Type of element that contains model command*/
    node_type;
    /**Content of model */
    reference;
    /**type of data model (array, number, string, ecc..) */
    stored_data_type = "";
    constructor(attribute) {
        super(attribute);
    }
    render(node) {
        if (node.reference.length && this.reference && node.element) {
            let _value = node.reference[0].value;
            let _new_value = Support.getValue(node.context, this.reference);
            let _debug = null;
            switch (this.node_type) {
                case "INPUT":
                case "TEXTAREA":
                    let _type = node.element?.getAttribute("type");
                    switch (_type) {
                        case "checkbox":
                        case "radio":
                            let _checked = _value != null ? Array.isArray(_new_value) ? _new_value.includes(_value) : _value == _new_value : _new_value;
                            _debug = _checked;
                            node.reference[0].checked = _debug;
                            break;
                        default:
                            _debug = this.readValue(node.context, node.settings);
                            node.reference[0].value = _debug;
                            break;
                    }
                    break;
                case "SELECT":
                    if (Array.isArray(_new_value)) {
                        _debug = [];
                        for (let option of Array.from(node.reference[0].options)) {
                            option.selected = _new_value.includes(option.value) || _new_value.includes(option.text);
                            if (option.selected)
                                _debug.push(option.value);
                        }
                    }
                    else {
                        _debug = _new_value;
                        node.reference[0].value = _debug;
                    }
                    break;
                default:
                    _debug = this.readValue(node.context, node.settings);
                    let _element = Support.templateFromString(_debug.toString())?.firstChild;
                    node.removeChildren();
                    if (_element)
                        node.append(_element);
                    break;
            }
            this._handler.trigger(Collection.node_event.render, { type: node.element?.getAttribute("type"), value: _debug });
        }
    }
    accept(options) {
        this.reference = options.value;
        this.node_type = options.nodename;
        this._handler.trigger(Collection.node_event.setup, options);
    }
    readValue(context, settings) {
        return this.reference ? Support.format(Support.getValue(context, this.reference), settings?.formatters) : "";
    }
    updateDataSet(input) {
        if (this.reference) {
            let _element = input.reference[0];
            let _value = Support.getValue(input.context, this.reference);
            let _new_value = _element.value;
            let _input_type = _element.getAttribute("type");
            switch (input.nodeName) {
                case "SELECT":
                    if (Array.isArray(_value)) {
                        if (_value.includes(_new_value)) {
                            Support.setValue(input.context, this.reference, _value.filter(e => e != _new_value));
                        }
                        else {
                            Support.setValue(input.context, this.reference, _value.push(_new_value));
                        }
                    }
                    else {
                        Support.setValue(input.context, this.reference, _new_value);
                    }
                    break;
                default:
                    switch (_input_type) {
                        case "checkbox":
                        case "radio":
                            if (_new_value) {
                                if (Array.isArray(_value)) {
                                    if (_input_type == "radio")
                                        Support.setValue(input.context, this.reference, []);
                                    if (_value.includes(_new_value)) {
                                        Support.setValue(input.context, this.reference, _value.filter(e => e != _new_value));
                                    }
                                    else {
                                        Support.setValue(input.context, this.reference, _value.push(_new_value));
                                    }
                                }
                                else {
                                    Support.setValue(input.context, this.reference, input.element.checked ? _new_value : "");
                                }
                            }
                            else {
                                Support.setValue(input.context, this.reference, input.element.checked);
                            }
                            break;
                        default:
                            Support.setValue(input.context, this.reference, _new_value);
                            break;
                    }
                    break;
            }
        }
    }
    clone(attribute) {
        return new cModel(attribute);
    }
}
class cFor extends Command {
    static key = "cmd-for";
    static filter_key = "cmd-filter";
    static sort_key = "cmd-sort";
    static regexp = /(CMD-FOR)|(cmd-for)/gm;
    /**separator key in command attribute */
    separator = " in ";
    /**Index reference used inside the template */
    index = ":index";
    /**template to repeat */
    template = "";
    /**alias of data used inside the template */
    alias = "";
    /**reference to node's array into data context */
    reference = "";
    _filter = "";
    _sort = "";
    _desc = false;
    _data_length = 0;
    _nodes_backup = [];
    constructor(attribute) {
        super(attribute);
    }
    render(node) {
        try {
            let _data = this.sort(Support.getValue(node.context, this.reference)); //getting data
            if (_data != null && _data.length != this._data_length) {
                if (_data && Array.isArray(_data)) {
                    node.incubator.textContent = ""; //reset node incubator
                    this._nodes_backup = [];
                    for (let i = 0; i < _data.length; i++) {
                        //Duplicate parent context for iteration
                        let _context = Support.cloneCollection(node.context);
                        //filter item based on filter settings
                        if (this.filter(_data[i], i)) {
                            //build and prepare html template code
                            let _html = this.template.replace(new RegExp(this.index, "g"), i.toString());
                            _html = _html.replaceAll(this.index, i.toString());
                            //convert html string code to Document Fragment
                            let _template = Support.templateFromString(_html)?.firstChild;
                            //Initialize virtual node tree of template
                            let _new_node = vNode.newInstance(_template, node.settings);
                            //setup internal reactivity rules with passive dynamic update of parent data 
                            let _reactive = {
                                get: (_target, _key) => {
                                    if (_key && typeof _data[i] == "object")
                                        return _data[i][_key];
                                    return _data[i];
                                },
                                set: (_target, _key, newvalue) => {
                                    if (_target === _data[i])
                                        Support.setValue(_data[i], _key, newvalue);
                                    else
                                        _data[i] = newvalue;
                                    _new_node.update(true);
                                }
                            };
                            //inject current array value into internal context
                            if (Support.isPrimitive(_data[i])) {
                                ref(_context, this.alias, _data[i], _reactive);
                            }
                            else {
                                _context[this.alias] = react(_data[i], _reactive);
                            }
                            _new_node.onDataset((data) => {
                                if (Support.isPrimitive(_data[i])) {
                                    ref(data, this.alias, _data[i], _reactive);
                                }
                                else {
                                    data[this.alias] = react(_data[i], _reactive);
                                }
                            });
                            _new_node.setup();
                            _new_node.elaborate(_context, node.settings); //render template content
                            //inject the result in node's incubator
                            for (const render of _new_node.reference) {
                                node.incubator.appendChild(render);
                            }
                            this._nodes_backup?.push(_new_node);
                        }
                    }
                    this._handler.trigger(Collection.node_event.render, { data: _data, stamp: node.incubator });
                    node.replaceNodes(); //replace current reference with elaborated value
                }
            }
            else {
                for (const node of this._nodes_backup) {
                    node.update(true);
                }
            }
            this._data_length = _data.length;
        }
        catch (ex) {
            log(ex, Collection.message_type.error);
        }
    }
    accept(options) {
        this.template = options.others?.template;
        this._filter = options.others?.filter;
        this._desc = options.others?.sort?.toLowerCase().includes("desc");
        this._sort = options.others?.sort?.replace(/desc/i, "").trim();
        let _content = options.value.split(this.separator);
        if (_content.length == 2) {
            this.alias = _content[0];
            this.reference = _content[1];
        }
        this._handler.trigger(Collection.node_event.setup, options);
    }
    sort(data) {
        if (data && this._sort) {
            let _param = this._sort
                .replace(this.alias + ".", "")
                .replace(this.alias, "")
                .trim();
            return data.sort(Support.dynamicSort(_param, this._desc));
        }
        return data;
    }
    filter(item, index) {
        if (this._filter) {
            let _function = "return " + this._filter
                .replace(new RegExp(this.index, "g"), index.toString())
                .replace(new RegExp(this.alias, "g"), "this");
            return Support.runFunctionByString(_function, item);
        }
        return true;
    }
    clone(attribute) {
        return new cFor(attribute);
    }
}
class cOn extends Command {
    static key = "cmd-on";
    static regexp = /(CMD-ON:[a-zA-Z-]+)|(cmd-on:[a-zA-Z-]+)|(\@[a-zA-Z-]+)/gm;
    setted = false;
    event = {
        name: "", action: async () => { }
    };
    constructor(attribute) {
        super(attribute);
    }
    render(node) {
        let _me = this;
        if (!this.setted && node.reference.length) {
            node.reference[0].addEventListener(this.event.name, function (evt) {
                _me._handler.trigger(Collection.node_event.render, _me.event.name);
                return _me.event.action(evt, node.context);
            });
            this.setted = true;
        }
    }
    accept(options) {
        this.event = {
            name: options.attribute,
            action: function (evt, context) { return elaborateContent(options.value, context, evt); }
        };
        this._handler.trigger(Collection.node_event.setup, options);
    }
    clone(attribute) {
        return new cOn(attribute);
    }
}
class cIf extends Command {
    static key = "cmd-if";
    static key_elseif = "cmd-elseif";
    static key_else = "cmd-else";
    static regexp = /(CMD-IF)|(cmd-if)/gm;
    conditions = [];
    constructor(attribute) {
        super(attribute);
    }
    render(node) {
        try {
            node.incubator.textContent = ""; //reset node incubator
            let _render = false;
            let i = 0;
            while (!_render && i < this.conditions.length) {
                _render = this.conditions[i].condition(node.context);
                let _template = this.conditions[i].template?.cloneNode(true);
                if (_render && _template) {
                    let _vnode = vNode.newInstance(_template, node.settings);
                    _vnode.setup();
                    _vnode.elaborate(node.context, node.settings);
                    //inject the result in node's incubator
                    for (const render of _vnode.reference) {
                        node.incubator.appendChild(render);
                    }
                    this._handler.trigger(Collection.node_event.render, {
                        condition: this.conditions[i].condition.toString(),
                        original: this.conditions[i].template,
                        stamp: _vnode
                    });
                }
                i++;
            }
            node.replaceNodes(); //replace current reference with elaborated value
        }
        catch (ex) {
            log(ex, Collection.message_type.error);
        }
    }
    accept(options) {
        this.conditions = options.others;
        this._handler.trigger(Collection.node_event.setup, options);
    }
    clone(attribute) {
        return new cIf(attribute);
    }
}
class cBind extends Command {
    static key = "cmd-bind";
    static regexp = /(CMD-BIND:[a-zA-Z-]+)|(cmd-bind:[a-zA-Z-]+)|(:[a-zA-Z-]+)/gm;
    attribute_bind = "";
    reference = "";
    constructor(attribute) {
        super(attribute);
    }
    render(node) {
        if (node.reference.length && this.reference && this.attribute_bind) {
            let _value = elaborateContent(this.reference, node.context);
            if (typeof _value == 'boolean' || _value == null) {
                if (_value)
                    node.reference[0].setAttribute(this.attribute_bind, "");
                else
                    node.reference[0].removeAttribute(this.attribute_bind);
            }
            else {
                node.reference[0].setAttribute(this.attribute_bind, _value);
            }
            this._handler.trigger(Collection.node_event.render, {
                attribute: this.attribute_bind,
                stamp: _value
            });
        }
    }
    accept(options) {
        this.reference = options.value;
        this.attribute_bind = options.attribute;
        this._handler.trigger(Collection.node_event.setup, options);
    }
    clone(attribute) {
        return new cBind(attribute);
    }
}
export { CommandVisitor };
export { cModel, cFor, cOn, cIf, cBind };