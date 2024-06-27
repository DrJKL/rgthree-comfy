import {
  type LiteGraph as TLiteGraph,
  type LGraphGroup,
  type Vector2,
  type LGraphCanvas as TLGraphCanvas,
} from "typings/litegraph.js";

declare const LGraphCanvas: typeof TLGraphCanvas;
declare const LiteGraph: typeof TLiteGraph;

type HasTitle = { title: string };
type HasPos = { pos: Vector2 };
type HasColor = { color: string }; // Possible to extend to bgcolor and boxcolor

type PosSortOptions = { sort: "position" };
type TitleSortOptions = { sort: "custom alphabet" | "alphanumeric"; customAlphabet?: string };
type SortOptions = PosSortOptions | TitleSortOptions;

type GraphCanvasColors = keyof (typeof LGraphCanvas.node_colors)[string];
type ColorFilterOptions = { matchColors?: string; nodeColorOption: GraphCanvasColors };
type TitleFilterOptions = { matchTitle?: string };

export type SortType = "custom alphabet" | "alphanumeric" | "position";

export function sortBy<T extends HasTitle & HasPos>(items: T[], options: SortOptions): T[] {
  const { sort } = options;

  if (sort === "position") {
    // Assumes sorted
    return sortByPosition(items);
  }

  const { customAlphabet: customAlphaStr } = options;
  if (!customAlphaStr || sort === "alphanumeric") {
    return [...items].sort((a, b) => a.title.localeCompare(b.title));
  }

  let customAlphabet: string[] = customAlphaStr.includes(",")
    ? customAlphaStr.toLocaleLowerCase().split(",")
    : customAlphaStr.toLocaleLowerCase().trim().split("");

  if (!customAlphabet.length) {
    return items;
  }

  items.sort((a, b) => {
    let aIndex = -1;
    let bIndex = -1;
    // Loop and find indexes. As we're finding multiple, a single for loop is more efficient.
    for (const [index, alpha] of customAlphabet!.entries()) {
      aIndex = aIndex < 0 ? (a.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : aIndex;
      bIndex = bIndex < 0 ? (b.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : bIndex;
      if (aIndex > -1 && bIndex > -1) {
        break;
      }
    }
    // Now compare.
    if (aIndex > -1 && bIndex > -1) {
      const ret = aIndex - bIndex;
      if (ret !== 0) {
        return ret;
      }
      return a.title.localeCompare(b.title);
    }
    if (aIndex > -1) {
      return -1;
    }
    if (bIndex > -1) {
      return 1;
    }
    return a.title.localeCompare(b.title);
  });
  return items;
}

function sortByPosition<T extends HasPos>(items: T[]): T[] {
  return items.sort((a, b) => {
    // Sort by y, then x, clamped to 30.
    const aY = Math.floor(a.pos[1] / 30);
    const bY = Math.floor(b.pos[1] / 30);
    if (aY != bY) {
      return aY - bY;
    }
    const aX = Math.floor(a.pos[0] / 30);
    const bX = Math.floor(b.pos[0] / 30);
    return aX - bX;
  });
}

function normalizeColor(color: string): string {
  const trimmed = color.replace("#", "").trim().toLocaleLowerCase();
  const fullHex = trimmed.length === 3 ? trimmed.replace(/(.)(.)(.)/, "$1$1$2$2$3$3") : trimmed;
  return `#${fullHex}`;
}

export function filterByColor<T extends HasColor>(
  items: T[],
  options: ColorFilterOptions = { nodeColorOption: "groupcolor" },
): T[] {
  const { matchColors, nodeColorOption } = options;
  if (!matchColors) {
    return items;
  }

  const filterColors = (matchColors.split(",") ?? [])
    .filter((c) => c.trim())
    .map((color) => color.trim().toLocaleLowerCase())
    .map((color) => LGraphCanvas.node_colors[color]?.[nodeColorOption] ?? color)
    .map((color) => normalizeColor(color));

  if (!filterColors.length) {
    return items;
  }

  return items.filter((item) => {
    if (!item.color) {
      return false;
    }
    let color = normalizeColor(item.color);
    return filterColors.includes(color);
  });
}

export function filterByTitle<T extends HasTitle>(
  items: T[],
  options: TitleFilterOptions = {},
): T[] {
  const { matchTitle } = options;
  if (!matchTitle) {
    return items;
  }

  const matchPattern = new RegExp(matchTitle, "i");
  return items.filter((item) => {
    try {
      return matchPattern.exec(item.title);
    } catch (e) {
      console.error(e);
    }
    return true; // Default to include on failure
  });
}

/**
 * Adds `_rgthreeHasAnyActiveNode` augment to group to cache state
 *
 * @param group Group to check
 * @returns true if any nodes are set to ALWAYS in the group
 */
export function groupHasActiveNode(group: LGraphGroup): boolean {
  group._rgthreeHasAnyActiveNode = group._nodes.some((n) => n.mode === LiteGraph.ALWAYS);
  return group._rgthreeHasAnyActiveNode;
}