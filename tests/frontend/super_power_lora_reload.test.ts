import {readFileSync} from "node:fs";
import {join} from "node:path";
import {runInNewContext} from "node:vm";
import {expect, it, vi} from "vitest";

import {LGraph, LGraphNode, LiteGraph} from "@/lib/litegraph/src/litegraph";

const root = process.env.RGTHREE_ROOT;
if (!root) throw new Error("Set RGTHREE_ROOT to the rgthree-comfy checkout.");

const source = [
  "common/shared_utils.js",
  "comfyui/utils_widgets.js",
  "comfyui/base_node.js",
  "comfyui/super_power_lora_loader.js",
]
  .map((file) =>
    readFileSync(join(root, "web", file), "utf8")
      .replace(/^import .*;\r?$/gm, "")
      .replace(/^export /gm, ""),
  )
  .join("\n");

it.each([false, true])("preserves LoRA rows across reloads with tags=%s", (tags) => {
  runInNewContext(
    `${source}
    RgthreeSuperPowerLoraLoader.nodeData = {
      name: "Super Power Lora Loader (rgthree)", input: {required: {}},
      output: [], output_name: [], output_is_list: []
    };
    function createLoader() {
      const graph = new LGraph();
      const node = new RgthreeSuperPowerLoraLoader("reload test");
      graph.add(node);
      node.onNodeCreated();
      return node;
    }
    function reload(node) {
      const saved = JSON.parse(JSON.stringify(node.serialize()));
      node.graph.remove(node);
      const restored = createLoader();
      restored.configure(saved);
      return restored;
    }
    function values(node) {
      return {
        rows: node.widgets.filter(w => w.name.startsWith("lora_")).map(w => w.value),
        saved: node.serialize().widgets_values.filter(v => v?.lora !== undefined)
      };
    }
    const expected = [
      {on: true, lora: "same.safetensors", strength: 0.65, tag: "General", triggerWord: "ink"},
      {on: false, lora: "same.safetensors", strength: 0.3, tag: "General", triggerWord: "detail"}
    ];
    const initial = createLoader();
    initial.properties["@Enable Tags"] = tags;
    initial.addNewLoraWidget().value = {...expected[0]};
    initial.addNewLoraWidget().value = {...expected[1]};
    const first = reload(initial);
    const firstValues = values(first);
    const second = reload(first);
    const secondValues = values(second);
    const third = reload(second);
    expect([firstValues, secondValues, values(third)]).toEqual([
      {rows: expected, saved: expected},
      {rows: expected, saved: expected},
      {rows: expected, saved: expected}
    ]);
    third.graph.remove(third);
  `,
    {
      LGraph,
      LGraphNode,
      LiteGraph: Object.create(LiteGraph),
      ComfyWidgets: {},
      EventTarget,
      setTimeout: vi.fn(),
      tags,
      expect,
      app: {registerExtension() {}},
      rgthree: {newLogSession() {}, invokeExtensionsAsync() {}},
      rgthreeApi: {getLoras: () => Promise.resolve([])},
      NodeTypesString: {SUPER_POWER_LORA_LOADER: "Super Power Lora Loader (rgthree)"},
    },
    {timeout: 5000},
  );
});
