import type { AdjustedMouseEvent, LGraphNode, Vector2 } from "./litegraph";
import type {Constructor} from "./index";
import type {RgthreeBaseVirtualNode} from '../comfyui/base_node.js'

export type AdjustedMouseCustomEvent = CustomEvent<{ originalEvent: AdjustedMouseEvent }>;


export interface RgthreeBaseVirtualNodeConstructor extends Constructor<RgthreeBaseVirtualNode> {
	static type: string;
	static category: string;
	static _category: string;
}


export interface RgthreeBaseServerNodeConstructor extends Constructor<RgthreeBaseServerNode> {
	static nodeType: ComfyNodeConstructor;
	static nodeData: ComfyObjectInfo;
	static __registeredForOverride__: boolean;
  onRegisteredForOverride(comfyClass: any, rgthreeClass: any) : void;
}


export type RgthreeModelInfo = {
  file?: string;
  name?: string;
  type?: string;
  baseModel?: string;
  links?: string[];
  strengthMin?: number;
  strengthMax?: number;
  triggerWords?: string[];
  description?: string;
  sha256?: string;
  path?: string;
  images?: {
    url: string;
    civitaiUrl?: string;
    steps?: string|number;
    cfg?: string|number;
    type?: 'image'|'video';
    sampler?: string;
    model?: string;
    seed?: string;
    negative?: string;
    positive?: string;
    resources?: {name?: string, type?: string, weight?: string|number}[];
  }[]
  userTags?: string[];
  userNote?: string;
  raw?: any;
  // This one is just on the client.
  filterDir?: string;
}
