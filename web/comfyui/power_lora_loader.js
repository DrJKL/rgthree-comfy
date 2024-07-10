var _a, _b;
import { app } from "../../scripts/app.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";
import { NodeTypesString } from "./constants.js";
import { drawInfoIcon, drawNumberWidgetPart, drawRoundedRectangle, drawTogglePart, fitString, isLowQuality, } from "./utils_canvas.js";
import { RgthreeBaseWidget, RgthreeBetterButtonWidget, RgthreeDividerWidget, } from "./utils_widgets.js";
import { rgthreeApi } from "../../rgthree/common/rgthree_api.js";
import { showLoraChooser } from "./utils_menu.js";
import { moveArrayItem, removeArrayItem } from "../../rgthree/common/shared_utils.js";
import { RgthreeLoraInfoDialog } from "./dialog_info.js";
import { LORA_INFO_SERVICE } from "../../rgthree/common/model_info_service.js";
const PROP_LABEL_SHOW_STRENGTHS = "Show Strengths";
const PROP_LABEL_SHOW_STRENGTHS_STATIC = `@${PROP_LABEL_SHOW_STRENGTHS}`;
const PROP_VALUE_SHOW_STRENGTHS_SINGLE = "Single Strength";
const PROP_VALUE_SHOW_STRENGTHS_SEPARATE = "Separate Model & Clip";
const PROP_LABEL_NAME_OPTIONS = "Display name type";
const PROP_LABEL_NAME_OPTIONS_STATIC = `@${PROP_LABEL_NAME_OPTIONS}`;
const PROP_VALUE_NAME_OPTIONS_FILENAME = "LoRA Filename";
const PROP_VALUE_NAME_OPTIONS_CIVITAI = "Civitai Name (if fetched)";
class RgthreePowerLoraLoader extends RgthreeBaseServerNode {
    constructor(title = NODE_CLASS.title) {
        super(title);
        this.serialize_widgets = true;
        this.logger = rgthree.newLogSession(`[Power Lora Stack]`);
        this.loraWidgetsCounter = 0;
        this.widgetButtonSpacer = null;
        this.commonPrefix = '';
        this.properties[PROP_LABEL_SHOW_STRENGTHS] = PROP_VALUE_SHOW_STRENGTHS_SINGLE;
        this.properties[PROP_LABEL_NAME_OPTIONS] = PROP_VALUE_NAME_OPTIONS_CIVITAI;
        rgthreeApi.getLoras();
    }
    configure(info) {
        var _c;
        while ((_c = this.widgets) === null || _c === void 0 ? void 0 : _c.length)
            this.removeWidget(0);
        this.widgetButtonSpacer = null;
        super.configure(info);
        this._tempWidth = this.size[0];
        this._tempHeight = this.size[1];
        for (const widgetValue of info.widgets_values || []) {
            if ((widgetValue === null || widgetValue === void 0 ? void 0 : widgetValue.lora) !== undefined) {
                const widget = this.addNewLoraWidget();
                widget.value = { ...widgetValue };
            }
        }
        this.addNonLoraWidgets();
        this.size[0] = this._tempWidth;
        this.size[1] = Math.max(this._tempHeight, this.computeSize()[1]);
    }
    onNodeCreated() {
        var _c;
        (_c = super.onNodeCreated) === null || _c === void 0 ? void 0 : _c.call(this);
        this.addNonLoraWidgets();
        const computed = this.computeSize();
        this.size = this.size || [0, 0];
        this.size[0] = Math.max(this.size[0], computed[0]);
        this.size[1] = Math.max(this.size[1], computed[1]);
        this.setDirtyCanvas(true, true);
    }
    getExtraMenuOptions(canvas, options) {
        var _c;
        (_c = super.getExtraMenuOptions) === null || _c === void 0 ? void 0 : _c.apply(this, [...arguments]);
        const fetchInfoMenuItem = {
            content: "Fetch info for all LoRAs",
            callback: (_value, _options, _event, _parentMenu, _node) => {
                const loraWidgets = this.widgets
                    .filter((widget) => widget instanceof PowerLoraLoaderWidget);
                const refreshPromises = loraWidgets
                    .map(widget => widget.getLoraInfo(true));
                Promise.all(refreshPromises).then((loraInfo) => {
                });
            },
        };
        const fixPathsMenuItem = {
            content: "Update paths for all LoRAs",
            callback: (_value, _options, _event, _parentMenu, _node) => {
                const loraWidgets = this.widgets.filter((widget) => widget instanceof PowerLoraLoaderWidget);
                const loras = loraWidgets
                    .map((widget) => widget.value.lora)
                    .filter((file) => file !== null);
                this.logger.debugParts("Updating Possibly outdated Lora Paths.");
                MODEL_INFO_SERVICE.getCorrectedLoraPaths(loras).then((correctedPaths) => {
                    if (!correctedPaths) {
                        this.logger.debugParts('Corrected Paths not found (null response)');
                        return;
                    }
                    for (const widget of loraWidgets) {
                        const loraName = widget.value.lora;
                        if (!loraName) {
                            continue;
                        }
                        const correctedNameMaybe = correctedPaths[loraName];
                        if (!correctedNameMaybe || loraName === correctedNameMaybe) {
                            continue;
                        }
                        widget.value.lora = correctedNameMaybe;
                    }
                    this.setDirtyCanvas(true, true);
                });
            },
        };
        options.splice(options.length - 1, 0, fetchInfoMenuItem, fixPathsMenuItem);
    }
    updateCommonPrefix() {
        if (!this.hasLoraWidgets) {
            return;
        }
        const loraWidgets = this.getLoraWidgets();
        const loraNames = loraWidgets.map(w => w.value.lora).filter((lora) => lora != null);
        const prefix = longestCommonPrefix(loraNames);
        const separator = prefix.includes('\\') ? '\\' : '/';
        this.commonPrefix = prefix.substring(0, prefix.lastIndexOf(separator) + 1);
    }
    addNewLoraWidget(lora) {
        this.loraWidgetsCounter++;
        const widget = this.addCustomWidget(new PowerLoraLoaderWidget("lora_" + this.loraWidgetsCounter));
        if (lora)
            widget.setLora(lora);
        if (this.widgetButtonSpacer) {
            moveArrayItem(this.widgets, widget, this.widgets.indexOf(this.widgetButtonSpacer));
        }
        this.updateCommonPrefix();
        return widget;
    }
    addNonLoraWidgets() {
        moveArrayItem(this.widgets, this.addCustomWidget(new RgthreeDividerWidget({ marginTop: 4, marginBottom: 0, thickness: 0 })), 0);
        moveArrayItem(this.widgets, this.addCustomWidget(new PowerLoraLoaderHeaderWidgetPath()), 1);
        moveArrayItem(this.widgets, this.addCustomWidget(new PowerLoraLoaderHeaderWidget()), 2);
        this.widgetButtonSpacer = this.addCustomWidget(new RgthreeDividerWidget({ marginTop: 4, marginBottom: 0, thickness: 0 }));
        this.addCustomWidget(new RgthreeBetterButtonWidget("➕ Add Lora", (event, pos, node) => {
            rgthreeApi.getLoras().then((loras) => {
                showLoraChooser(event, (value, _options, leafEvent) => {
                    var _c;
                    if (typeof value === "string") {
                        if (value.includes("Power Lora Chooser")) {
                        }
                        else if (value !== "NONE") {
                            this.addNewLoraWidget(value);
                            const computed = this.computeSize();
                            const tempHeight = (_c = this._tempHeight) !== null && _c !== void 0 ? _c : 15;
                            this.size[1] = Math.max(tempHeight, computed[1]);
                            this.setDirtyCanvas(true, true);
                        }
                    }
                    return leafEvent.shiftKey;
                }, null, [...loras]);
            });
            return true;
        }));
    }
    getSlotInPosition(canvasX, canvasY) {
        var _c;
        const slot = super.getSlotInPosition(canvasX, canvasY);
        if (!slot) {
            let lastWidget = null;
            for (const widget of this.widgets) {
                if (!widget.last_y)
                    return;
                if (canvasY > this.pos[1] + widget.last_y) {
                    lastWidget = widget;
                    continue;
                }
                break;
            }
            if ((_c = lastWidget === null || lastWidget === void 0 ? void 0 : lastWidget.name) === null || _c === void 0 ? void 0 : _c.startsWith("lora_")) {
                return { widget: lastWidget, output: { type: "LORA WIDGET" } };
            }
        }
        return slot;
    }
    getSlotMenuOptions(slot) {
        var _c, _d, _e, _f, _g, _h;
        if ((_d = (_c = slot === null || slot === void 0 ? void 0 : slot.widget) === null || _c === void 0 ? void 0 : _c.name) === null || _d === void 0 ? void 0 : _d.startsWith("lora_")) {
            const widget = slot.widget;
            const index = this.widgets.indexOf(widget);
            const canMoveUp = !!((_f = (_e = this.widgets[index - 1]) === null || _e === void 0 ? void 0 : _e.name) === null || _f === void 0 ? void 0 : _f.startsWith("lora_"));
            const canMoveDown = !!((_h = (_g = this.widgets[index + 1]) === null || _g === void 0 ? void 0 : _g.name) === null || _h === void 0 ? void 0 : _h.startsWith("lora_"));
            const menuItems = [
                {
                    content: `ℹ️ Show Info`,
                    callback: () => {
                        widget.showLoraInfoDialog();
                    },
                },
                null,
                {
                    content: `${widget.value.on ? "⚫" : "🟢"} Toggle ${widget.value.on ? "Off" : "On"}`,
                    callback: () => {
                        widget.value.on = !widget.value.on;
                    },
                },
                {
                    content: `⬆️ Move Up`,
                    disabled: !canMoveUp,
                    callback: () => {
                        moveArrayItem(this.widgets, widget, index - 1);
                    },
                },
                {
                    content: `⬇️ Move Down`,
                    disabled: !canMoveDown,
                    callback: () => {
                        moveArrayItem(this.widgets, widget, index + 1);
                    },
                },
                {
                    content: `🗑️ Remove`,
                    callback: () => {
                        removeArrayItem(this.widgets, widget);
                        this.updateCommonPrefix();
                    },
                },
            ];
            let canvas = app.canvas;
            new LiteGraph.ContextMenu(menuItems, { title: "LORA WIDGET", event: rgthree.lastAdjustedMouseEvent }, canvas.getCanvasWindow());
            return null;
        }
        return this.defaultGetSlotMenuOptions(slot);
    }
    refreshComboInNode(defs) {
        rgthreeApi.getLoras(true);
    }
    hasLoraWidgets() {
        var _c;
        return !!((_c = this.widgets) === null || _c === void 0 ? void 0 : _c.find((w) => { var _c; return (_c = w.name) === null || _c === void 0 ? void 0 : _c.startsWith("lora_"); }));
    }
    getLoraWidgets() {
        var _c, _d, _e;
        return (_e = (_d = (_c = this.widgets) === null || _c === void 0 ? void 0 : _c.filter((w) => { var _c; return (_c = w.name) === null || _c === void 0 ? void 0 : _c.startsWith("lora_"); })) === null || _d === void 0 ? void 0 : _d.filter((w) => w instanceof PowerLoraLoaderWidget)) !== null && _e !== void 0 ? _e : [];
    }
    allLorasState() {
        var _c, _d, _e;
        let allOn = true;
        let allOff = true;
        for (const widget of this.widgets) {
            if ((_c = widget.name) === null || _c === void 0 ? void 0 : _c.startsWith("lora_")) {
                const on = (_d = widget.value) === null || _d === void 0 ? void 0 : _d.on;
                allOn = allOn && on === true;
                allOff = allOff && on === false;
                if (!allOn && !allOff) {
                    return null;
                }
            }
        }
        return allOn && ((_e = this.widgets) === null || _e === void 0 ? void 0 : _e.length) ? true : false;
    }
    toggleAllLoras() {
        var _c;
        const allOn = this.allLorasState();
        const toggledTo = !allOn ? true : false;
        for (const widget of this.widgets) {
            if ((_c = widget.name) === null || _c === void 0 ? void 0 : _c.startsWith("lora_")) {
                widget.value.on = toggledTo;
            }
        }
    }
    static setUp(comfyClass, nodeData) {
        RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, NODE_CLASS);
    }
    static onRegisteredForOverride(comfyClass, ctxClass) {
        addConnectionLayoutSupport(NODE_CLASS, app, [
            ["Left", "Right"],
            ["Right", "Left"],
        ]);
        setTimeout(() => {
            NODE_CLASS.category = comfyClass.category;
        });
    }
    getHelp() {
        return `
      <p>
        The ${this.type.replace("(rgthree)", "")} is a powerful node that condenses 100s of pixels
        of functionality in a single, dynamic node that allows you to add loras, change strengths,
        and quickly toggle on/off all without taking up half your screen.
      </p>
      <ul>
        <li><p>
          Add as many Lora's as you would like by clicking the "+ Add Lora" button.
          There's no real limit!
        </p></li>
        <li><p>
          Right-click on a Lora widget for special options to move the lora up or down
          (no image affect, only presentational), toggle it on/off, or delete the row all together.
        </p></li>
        <li>
          <p>
            <strong>Properties.</strong> You can change the following properties (by right-clicking
            on the node, and select "Properties" or "Properties Panel" from the menu):
          </p>
          <ul>
            <li><p>
              <code>${PROP_LABEL_SHOW_STRENGTHS}</code> - Change between showing a single, simple
              strength (which will be used for both model and clip), or a more advanced view with
              both model and clip strengths being modifiable.
            </p></li>
          </ul>
        </li>
      </ul>`;
    }
}
_a = PROP_LABEL_SHOW_STRENGTHS_STATIC, _b = PROP_LABEL_NAME_OPTIONS_STATIC;
RgthreePowerLoraLoader.title = NodeTypesString.POWER_LORA_LOADER;
RgthreePowerLoraLoader.type = NodeTypesString.POWER_LORA_LOADER;
RgthreePowerLoraLoader.comfyClass = NodeTypesString.POWER_LORA_LOADER;
RgthreePowerLoraLoader[_a] = {
    type: "combo",
    values: [PROP_VALUE_SHOW_STRENGTHS_SINGLE, PROP_VALUE_SHOW_STRENGTHS_SEPARATE],
};
RgthreePowerLoraLoader[_b] = {
    type: "combo",
    values: [PROP_VALUE_NAME_OPTIONS_FILENAME, PROP_VALUE_NAME_OPTIONS_CIVITAI],
};
function longestCommonPrefix(strings) {
    var _c;
    const firstString = (_c = strings[0]) !== null && _c !== void 0 ? _c : '';
    for (let i = 0; i < firstString.length; i++) {
        for (const other of strings.slice(1)) {
            if ((other === null || other === void 0 ? void 0 : other[i]) !== firstString[i]) {
                return firstString.substring(0, i);
            }
        }
    }
    return firstString;
}
class PowerLoraLoaderHeaderWidgetPath extends RgthreeBaseWidget {
    constructor(name = "PowerLoraLoaderHeaderWidgetPath") {
        super(name);
        this.value = { type: "PowerLoraLoaderHeaderWidgetPath" };
    }
    draw(ctx, node, w, posY, height) {
        if (!node.commonPrefix) {
            return;
        }
        posY += 2;
        let midY = posY + height * 0.5;
        let posX = 10;
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(fitString(ctx, `LoRA Path: ${node.commonPrefix}`, w - 10), posX, midY);
    }
}
class PowerLoraLoaderHeaderWidget extends RgthreeBaseWidget {
    constructor(name = "PowerLoraLoaderHeaderWidget") {
        super(name);
        this.showModelAndClip = null;
        this.value = { type: "PowerLoraLoaderHeaderWidget" };
        this.hitAreas = {
            toggle: { bounds: [0, 0], onDown: this.onToggleDown },
        };
    }
    draw(ctx, node, w, posY, height) {
        if (!node.hasLoraWidgets()) {
            return;
        }
        this.showModelAndClip =
            node.properties[PROP_LABEL_SHOW_STRENGTHS] === PROP_VALUE_SHOW_STRENGTHS_SEPARATE;
        const margin = 10;
        const innerMargin = margin * 0.33;
        const lowQuality = isLowQuality();
        const allLoraState = node.allLorasState();
        posY += 2;
        let midY = posY + height * 0.5;
        let posX = 10;
        ctx.save();
        this.hitAreas.toggle.bounds = drawTogglePart(ctx, { posX, posY, height, value: allLoraState });
        if (!lowQuality) {
            posX += this.hitAreas.toggle.bounds[1] + innerMargin;
            ctx.globalAlpha = app.canvas.editor_alpha * 0.55;
            ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("Toggle All", posX, midY);
            let rposX = node.size[0] - margin - innerMargin - innerMargin;
            ctx.textAlign = "center";
            ctx.fillText(this.showModelAndClip ? "Clip" : "Strength", rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2, midY);
            if (this.showModelAndClip) {
                rposX = rposX - drawNumberWidgetPart.WIDTH_TOTAL - innerMargin * 2;
                ctx.fillText("Model", rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2, midY);
            }
        }
        ctx.restore();
    }
    onToggleDown(event, pos, node) {
        node.toggleAllLoras();
        this.cancelMouseDown();
        return true;
    }
}
const DEFAULT_LORA_WIDGET_DATA = {
    on: true,
    lora: null,
    strength: 1,
    strengthTwo: null,
};
class PowerLoraLoaderWidget extends RgthreeBaseWidget {
    constructor(name) {
        super(name);
        this.haveMouseMovedStrength = false;
        this.loraInfoPromise = null;
        this.loraInfo = null;
        this.showModelAndClip = null;
        this.hitAreas = {
            toggle: { bounds: [0, 0], onDown: this.onToggleDown },
            lora: { bounds: [0, 0], onDown: this.onLoraDown },
            strengthDec: { bounds: [0, 0], onDown: this.onStrengthDecDown },
            strengthVal: { bounds: [0, 0], onUp: this.onStrengthValUp },
            strengthInc: { bounds: [0, 0], onDown: this.onStrengthIncDown },
            strengthAny: { bounds: [0, 0], onMove: this.onStrengthAnyMove },
            strengthTwoDec: { bounds: [0, 0], onDown: this.onStrengthTwoDecDown },
            strengthTwoVal: { bounds: [0, 0], onUp: this.onStrengthTwoValUp },
            strengthTwoInc: { bounds: [0, 0], onDown: this.onStrengthTwoIncDown },
            strengthTwoAny: { bounds: [0, 0], onMove: this.onStrengthTwoAnyMove },
        };
        this._value = {
            on: true,
            lora: null,
            strength: 1,
            strengthTwo: null,
        };
    }
    set value(v) {
        this._value = v;
        if (typeof this._value !== "object") {
            this._value = { ...DEFAULT_LORA_WIDGET_DATA };
            if (this.showModelAndClip) {
                this._value.strengthTwo = this._value.strength;
            }
        }
        this.getLoraInfo();
    }
    get value() {
        return this._value;
    }
    setLora(lora) {
        this._value.lora = lora;
        this.getLoraInfo();
    }
    draw(ctx, node, w, posY, height) {
        var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        let currentShowModelAndClip = node.properties[PROP_LABEL_SHOW_STRENGTHS] === PROP_VALUE_SHOW_STRENGTHS_SEPARATE;
        let currentNameDisplayOption = node.properties[PROP_LABEL_NAME_OPTIONS];
        let { commonPrefix } = node;
        if (this.showModelAndClip !== currentShowModelAndClip) {
            let oldShowModelAndClip = this.showModelAndClip;
            this.showModelAndClip = currentShowModelAndClip;
            if (this.showModelAndClip) {
                if (oldShowModelAndClip != null) {
                    this.value.strengthTwo = (_c = this.value.strength) !== null && _c !== void 0 ? _c : 1;
                }
            }
            else {
                this.value.strengthTwo = null;
                this.hitAreas.strengthTwoDec.bounds = [0, -1];
                this.hitAreas.strengthTwoVal.bounds = [0, -1];
                this.hitAreas.strengthTwoInc.bounds = [0, -1];
                this.hitAreas.strengthTwoAny.bounds = [0, -1];
            }
        }
        ctx.save();
        const margin = 10;
        const innerMargin = margin * 0.33;
        const lowQuality = isLowQuality();
        const midY = posY + height * 0.5;
        let posX = margin;
        drawRoundedRectangle(ctx, { posX, posY, height, width: node.size[0] - margin * 2 });
        this.hitAreas.toggle.bounds = drawTogglePart(ctx, { posX, posY, height, value: this.value.on });
        posX += this.hitAreas.toggle.bounds[1] + innerMargin;
        if (lowQuality) {
            ctx.restore();
            return;
        }
        if (!this.value.on) {
            ctx.globalAlpha = app.canvas.editor_alpha * 0.4;
        }
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        let rposX = node.size[0] - margin - innerMargin - innerMargin;
        const strengthValue = this.showModelAndClip
            ? (_d = this.value.strengthTwo) !== null && _d !== void 0 ? _d : 1
            : (_e = this.value.strength) !== null && _e !== void 0 ? _e : 1;
        let textColor = undefined;
        if (((_f = this.loraInfo) === null || _f === void 0 ? void 0 : _f.strengthMax) != null && strengthValue > ((_g = this.loraInfo) === null || _g === void 0 ? void 0 : _g.strengthMax)) {
            textColor = "#c66";
        }
        else if (((_h = this.loraInfo) === null || _h === void 0 ? void 0 : _h.strengthMin) != null && strengthValue < ((_j = this.loraInfo) === null || _j === void 0 ? void 0 : _j.strengthMin)) {
            textColor = "#c66";
        }
        const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, {
            posX: node.size[0] - margin - innerMargin - innerMargin,
            posY,
            height,
            value: strengthValue,
            direction: -1,
            textColor,
        });
        this.hitAreas.strengthDec.bounds = leftArrow;
        this.hitAreas.strengthVal.bounds = text;
        this.hitAreas.strengthInc.bounds = rightArrow;
        this.hitAreas.strengthAny.bounds = [leftArrow[0], rightArrow[0] + rightArrow[1] - leftArrow[0]];
        rposX = leftArrow[0] - innerMargin;
        if (this.showModelAndClip) {
            rposX -= innerMargin;
            this.hitAreas.strengthTwoDec.bounds = this.hitAreas.strengthDec.bounds;
            this.hitAreas.strengthTwoVal.bounds = this.hitAreas.strengthVal.bounds;
            this.hitAreas.strengthTwoInc.bounds = this.hitAreas.strengthInc.bounds;
            this.hitAreas.strengthTwoAny.bounds = this.hitAreas.strengthAny.bounds;
            let textColor = undefined;
            if (((_k = this.loraInfo) === null || _k === void 0 ? void 0 : _k.strengthMax) != null && this.value.strength > ((_l = this.loraInfo) === null || _l === void 0 ? void 0 : _l.strengthMax)) {
                textColor = "#c66";
            }
            else if (((_m = this.loraInfo) === null || _m === void 0 ? void 0 : _m.strengthMin) != null &&
                this.value.strength < ((_o = this.loraInfo) === null || _o === void 0 ? void 0 : _o.strengthMin)) {
                textColor = "#c66";
            }
            const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, {
                posX: rposX,
                posY,
                height,
                value: (_p = this.value.strength) !== null && _p !== void 0 ? _p : 1,
                direction: -1,
                textColor,
            });
            this.hitAreas.strengthDec.bounds = leftArrow;
            this.hitAreas.strengthVal.bounds = text;
            this.hitAreas.strengthInc.bounds = rightArrow;
            this.hitAreas.strengthAny.bounds = [
                leftArrow[0],
                rightArrow[0] + rightArrow[1] - leftArrow[0],
            ];
            rposX = leftArrow[0] - innerMargin;
        }
        const infoIconSize = height * 0.66;
        const infoWidth = infoIconSize + innerMargin + innerMargin;
        if (this.hitAreas["info"]) {
            rposX -= innerMargin;
            drawInfoIcon(ctx, rposX - infoIconSize, posY + (height - infoIconSize) / 2, infoIconSize);
            this.hitAreas.info.bounds = [rposX - infoIconSize, infoWidth];
            rposX = rposX - infoIconSize - innerMargin;
        }
        const loraWidth = rposX - posX;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const loraLabel = this.getLoraName(commonPrefix, currentNameDisplayOption);
        ctx.fillText(fitString(ctx, loraLabel, loraWidth), posX, midY);
        this.hitAreas.lora.bounds = [posX, loraWidth];
        posX += loraWidth + innerMargin;
        ctx.globalAlpha = app.canvas.editor_alpha;
        ctx.restore();
    }
    getLoraName(commonPrefix = '', nameDisplay = PROP_VALUE_NAME_OPTIONS_CIVITAI) {
        var _c, _d;
        if (((_c = this.loraInfo) === null || _c === void 0 ? void 0 : _c.name) && nameDisplay === PROP_VALUE_NAME_OPTIONS_CIVITAI) {
            return this.loraInfo.name;
        }
        const loraLabel = String(((_d = this.value) === null || _d === void 0 ? void 0 : _d.lora) || "None");
        const prunedLoraLabel = loraLabel.replace(/\.safetensors$/, '').substring(commonPrefix.length);
        return prunedLoraLabel;
    }
    serializeValue(serializedNode, widgetIndex) {
        var _c;
        const v = { ...this.value };
        if (!this.showModelAndClip) {
            delete v.strengthTwo;
        }
        else {
            this.value.strengthTwo = (_c = this.value.strengthTwo) !== null && _c !== void 0 ? _c : 1;
            v.strengthTwo = this.value.strengthTwo;
        }
        return v;
    }
    onToggleDown(event, pos, node) {
        this.value.on = !this.value.on;
        this.cancelMouseDown();
        return true;
    }
    onInfoDown(event, pos, node) {
        this.showLoraInfoDialog();
    }
    onLoraDown(event, pos, node) {
        showLoraChooser(event, (value) => {
            if (typeof value === "string") {
                this.value.lora = value;
                this.loraInfo = null;
                this.getLoraInfo();
            }
            node.setDirtyCanvas(true, true);
        });
        this.cancelMouseDown();
    }
    onStrengthDecDown(event, pos, node) {
        this.stepStrength(-1, false);
    }
    onStrengthIncDown(event, pos, node) {
        this.stepStrength(1, false);
    }
    onStrengthTwoDecDown(event, pos, node) {
        this.stepStrength(-1, true);
    }
    onStrengthTwoIncDown(event, pos, node) {
        this.stepStrength(1, true);
    }
    onStrengthAnyMove(event, pos, node) {
        this.doOnStrengthAnyMove(event, false);
    }
    onStrengthTwoAnyMove(event, pos, node) {
        this.doOnStrengthAnyMove(event, true);
    }
    doOnStrengthAnyMove(event, isTwo = false) {
        var _c;
        if (event.deltaX) {
            let prop = isTwo ? "strengthTwo" : "strength";
            this.haveMouseMovedStrength = true;
            this.value[prop] = ((_c = this.value[prop]) !== null && _c !== void 0 ? _c : 1) + event.deltaX * 0.05;
        }
    }
    onStrengthValUp(event, pos, node) {
        this.doOnStrengthValUp(event, false);
    }
    onStrengthTwoValUp(event, pos, node) {
        this.doOnStrengthValUp(event, true);
    }
    doOnStrengthValUp(event, isTwo = false) {
        if (this.haveMouseMovedStrength)
            return;
        let prop = isTwo ? "strengthTwo" : "strength";
        const canvas = app.canvas;
        canvas.prompt("Value", this.value[prop], (v) => (this.value[prop] = Number(v)), event);
    }
    onMouseUp(event, pos, node) {
        super.onMouseUp(event, pos, node);
        this.haveMouseMovedStrength = false;
    }
    showLoraInfoDialog() {
        if (!this.value.lora || this.value.lora === "None") {
            return;
        }
        const infoDialog = new RgthreeLoraInfoDialog(this.value.lora).show();
        infoDialog.addEventListener("close", ((e) => {
            if (e.detail.dirty) {
                this.getLoraInfo(true);
            }
        }));
    }
    stepStrength(direction, isTwo = false) {
        var _c;
        let step = 0.05;
        let prop = isTwo ? "strengthTwo" : "strength";
        let strength = ((_c = this.value[prop]) !== null && _c !== void 0 ? _c : 1) + step * direction;
        this.value[prop] = Math.round(strength * 100) / 100;
    }
    getLoraInfo(force = false) {
        if (!this.loraInfoPromise || force == true) {
            let promise;
            if (this.value.lora && this.value.lora != "None") {
                promise = LORA_INFO_SERVICE.getInfo(this.value.lora, force, true);
            }
            else {
                promise = Promise.resolve(null);
            }
            this.loraInfoPromise = promise.then((v) => (this.loraInfo = v));
        }
        return this.loraInfoPromise;
    }
}
const NODE_CLASS = RgthreePowerLoraLoader;
app.registerExtension({
    name: "rgthree.PowerLoraLoader",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === NODE_CLASS.type) {
            NODE_CLASS.setUp(nodeType, nodeData);
        }
    },
});
