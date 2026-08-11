import * as vscode from 'vscode';

interface EditorLayoutGroup {
  size?: number;
  groups?: EditorLayoutGroup[];
}

interface EditorLayout {
  orientation: number;
  groups: EditorLayoutGroup[];
}

interface ComputedGroupRect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

//
// グループ情報を返す
//

/** 木構造を解析してresultsに各Groupのインデックス、位置、ウィンドウサイズを返す
 *  _________
 *  |_0_| 2 |  0~3はresultsのインデックス
 *  |_1_|___|  この順番に葉ノードを格納する
 *  |_3_____|
 */
function computeGroupRects(
  node: EditorLayoutGroup,
  orientation: number, // 0なら横分割, 1なら縦分割
  x: number, // 各グループの左上のx
  y: number, // 各グループの左上のy
  width: number, // 各グループの横サイズ
  height: number, // 各グループの縦サイズ
  counter: { value: number }, // 葉ノードの番号
  results: ComputedGroupRect[],
): void {
  if (!node.groups || node.groups.length === 0) {
    results.push({ index: counter.value++, x, y, width, height }); // 葉ノード
    return;
  }

  const sizes = node.groups.map((g) => g.size ?? 1); // orientation=0なら各グループのwidth、1ならheight
  const total = sizes.reduce((a, b) => a + b, 0) || 1; // orientation=0なら全code領域の横幅、1なら縦幅

  let offset = 0;
  for (const child of node.groups) {
    const ratio = (child.size ?? 1) / total;

    if (orientation === 0) {
      // 横を処理、次は縦処理
      computeGroupRects(
        child,
        child.groups ? 1 - orientation : orientation,
        x + offset,
        y,
        width * ratio,
        height,
        counter,
        results,
      );
      offset += width * ratio;
    } else {
      // 縦を処理、次は横処理
      computeGroupRects(
        child,
        child.groups ? 1 - orientation : orientation,
        x,
        y + offset,
        width,
        height * ratio,
        counter,
        results,
      );
      offset += height * ratio;
    }
  }
}

/** viewColumnに対応するエディタの、見えている行数を計算する */
function getVisibleLineCountByViewColumn(viewColumn: number): number | null {
  const editor = vscode.window.visibleTextEditors.find((e) => e.viewColumn === viewColumn);
  if (!editor) return null;
  let count = 0;
  for (const range of editor.visibleRanges) {
    count += range.end.line - range.start.line + 1;
  }
  return count;
}

/** 隣接関係・サイズ比率・実測行数を含めた、各グループの情報を取得する */
export async function getGroupInfo(): Promise<
  {
    index: number; // グループのインデックス
    x: number; // グループの左上のxの位置
    y: number; // グループの右上のyの位置
    width: number; // グループの横幅。0から1で表現
    height: number; // グループの縦幅。0から1で表現
    isActive: boolean; // アクティブグループかどうか
    visibleLines: number | null; // 見えているコードのライン数（最終行以降のコードのない行数は取得できない）
    aboveIndex: number | null; // indexのグループの左上を起点として、上のグループが何であるかindexで教えてくれる
    belowIndex: number | null; // 下のGroup
    leftIndex: number | null; // 左のGroup
    rightIndex: number | null; // 右のGroup
  }[]
> {
  const layout = (await vscode.commands.executeCommand('vscode.getEditorLayout')) as EditorLayout;
  const results: ComputedGroupRect[] = [];
  const counter = { value: 0 };

  computeGroupRects({ groups: layout.groups } as EditorLayoutGroup, layout.orientation, 0, 0, 1, 1, counter, results);

  const EPSILON = 0.001;

  const findAdjacent = (target: ComputedGroupRect, direction: 'above' | 'below' | 'left' | 'right'): number | null => {
    for (const other of results) {
      if (other.index === target.index) continue;

      if (direction === 'above' && Math.abs(other.y + other.height - target.y) < EPSILON) {
        // targetの位置から左斜上と右斜上のGroupは排除する
        if (!(other.x + other.width <= target.x + EPSILON || target.x + target.width <= other.x + EPSILON)) {
          return other.index;
        }
      }
      if (direction === 'below' && Math.abs(target.y + target.height - other.y) < EPSILON) {
        // targetの位置から左斜下と右斜下のGroupは排除する
        if (!(other.x + other.width <= target.x + EPSILON || target.x + target.width <= other.x + EPSILON)) {
          return other.index;
        }
      }
      if (direction === 'left' && Math.abs(other.x + other.width - target.x) < EPSILON) {
        // targetの位置から左斜上と左斜下のGroupは排除する
        if (!(other.y + other.height <= target.y + EPSILON || target.y + target.height <= other.y + EPSILON)) {
          return other.index;
        }
      }
      if (direction === 'right' && Math.abs(target.x + target.width - other.x) < EPSILON) {
        // targetの位置から右斜上と右斜下のGroupは排除する
        if (!(other.y + other.height <= target.y + EPSILON || target.y + target.height <= other.y + EPSILON)) {
          return other.index;
        }
      }
    }
    return null;
  };

  // NOTE: tabGroups.allの呼び出し順番はresultsのindexの順番と同じでなければいけない
  const activeTabGroup = vscode.window.tabGroups.all.find((g) => g.isActive);
  // vscode.window.tabGroups.all.find((g) => console.log(g.viewColumn, g.isActive));
  const activeViewColumn = activeTabGroup?.viewColumn;

  return results.map((r, i) => {
    const assumedViewColumn = i + 1; // NOTE: resultsのindex=ViewColumn+1と仮定
    return {
      ...r,
      isActive: activeViewColumn !== undefined && assumedViewColumn === activeViewColumn,
      visibleLines: getVisibleLineCountByViewColumn(assumedViewColumn),
      aboveIndex: findAdjacent(r, 'above'),
      belowIndex: findAdjacent(r, 'below'),
      leftIndex: findAdjacent(r, 'left'),
      rightIndex: findAdjacent(r, 'right'),
    };
  });
}

//
// 各グループが均等サイズかどうかを返す
//

/**
 * レイアウトの木構造を探索し、すべての階層でsizeがほぼ均等かどうかを判定する
 * @param tolerance 均等サイズかどうかを判断する許容誤差
 * @returns trueならレイアウトがほぼ均等
 */
function areGroupSizesEqualImpl(node: EditorLayoutGroup, tolerance: number = 0.02): boolean {
  if (!node.groups || node.groups.length === 0) return true; // 葉ノード
  const sizes = node.groups.map((g) => g.size ?? 1);
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const allEqual = sizes.every((s) => Math.abs(s - avg) / avg <= tolerance);
  if (!allEqual) return false;
  return node.groups.every((child) => areGroupSizesEqualImpl(child, tolerance)); // 子階層もチェック
}

/** 各グループが均等サイズかどうかを判定する */
export async function areGroupSizesEqual(): Promise<boolean> {
  const layout = (await vscode.commands.executeCommand('vscode.getEditorLayout')) as EditorLayout;
  if (!layout || !layout.groups) return true;
  return areGroupSizesEqualImpl({ groups: layout.groups } as EditorLayoutGroup, 0.02);
}

//
// グループウィンドウのりサイズ関連
//

interface TreeNode {
  id: number;
  leafIndex: number | null;
  node: EditorLayoutGroup;
  ownArray: EditorLayoutGroup[];
  rawAbove: TreeNode | null;
  rawBelow: TreeNode | null;
  rawLeft: TreeNode | null;
  rawRight: TreeNode | null;
}

interface BuiltTree {
  allNodes: TreeNode[];
  layout: EditorLayout;
  containerOf: Map<EditorLayoutGroup[], TreeNode | null>;
}

type Direction = 'above' | 'below' | 'left' | 'right';
type ResizeDirection = 'left' | 'right' | 'up' | 'down';

export class GroupResizer {
  private minWidth = 230; // グループサイズの最小横幅（ピクセル）
  private minHeight = 80; // グループサイズの最小縦幅（ピクセル）
  private readonly resizeAmount: number; // １回のコマンドで変化するグループサイズ（ピクセル）

  constructor(resizeAmount: number = 40) {
    this.resizeAmount = resizeAmount;
  }

  setMinWidth(value: number): void {
    this.minWidth = value;
  }

  setMinHeight(value: number): void {
    this.minHeight = value;
  }

  getMinWidth(): number {
    return this.minWidth;
  }

  getMinHeight(): number {
    return this.minHeight;
  }

  /**
   * アクティブグループをdirection方向にgrow/shrinkする
   * @param direction 動かす方向
   * @param grow trueなら広げる、falseなら狭める
   */
  async resizeGroup(direction: ResizeDirection, grow: boolean): Promise<void> {
    await this.resizeActiveGroupBorder(direction, this.resizeAmount, grow);
  }
  async growLeft(): Promise<void> {
    await this.resizeActiveGroupBorder('left', this.resizeAmount, true);
  }
  async growRight(): Promise<void> {
    await this.resizeActiveGroupBorder('right', this.resizeAmount, true);
  }
  async growUp(): Promise<void> {
    await this.resizeActiveGroupBorder('up', this.resizeAmount, true);
  }
  async growDown(): Promise<void> {
    await this.resizeActiveGroupBorder('down', this.resizeAmount, true);
  }
  async shrinkLeft(): Promise<void> {
    await this.resizeActiveGroupBorder('left', this.resizeAmount, false);
  }
  async shrinkRight(): Promise<void> {
    await this.resizeActiveGroupBorder('right', this.resizeAmount, false);
  }
  async shrinkUp(): Promise<void> {
    await this.resizeActiveGroupBorder('up', this.resizeAmount, false);
  }
  async shrinkDown(): Promise<void> {
    await this.resizeActiveGroupBorder('down', this.resizeAmount, false);
  }

  /**
   * アクティブグループからdirection方向にグループがあるかどうか
   * @param direction 判定したい方向
   */
  async hasAdjacentGroup(direction: ResizeDirection): Promise<boolean> {
    const result = await this.getActiveLeaf();
    if (!result) return false;
    const dir: Direction = direction === 'up' ? 'above' : direction === 'down' ? 'below' : direction;
    return this.resolveOperateOn(result.leaf, dir, result.tree.containerOf) !== null;
  }
  async hasLeftGroup(): Promise<boolean> {
    const result = await this.getActiveLeaf();
    if (!result) return false;
    return this.resolveOperateOn(result.leaf, 'left', result.tree.containerOf) !== null;
  }
  async hasRightGroup(): Promise<boolean> {
    const result = await this.getActiveLeaf();
    if (!result) return false;
    return this.resolveOperateOn(result.leaf, 'right', result.tree.containerOf) !== null;
  }
  async hasUpGroup(): Promise<boolean> {
    const result = await this.getActiveLeaf();
    if (!result) return false;
    return this.resolveOperateOn(result.leaf, 'above', result.tree.containerOf) !== null;
  }
  async hasDownGroup(): Promise<boolean> {
    const result = await this.getActiveLeaf();
    if (!result) return false;
    return this.resolveOperateOn(result.leaf, 'below', result.tree.containerOf) !== null;
  }

  /** 木構造を解析し、allNodesとcontainerOfを作成する */
  private processArray(
    siblings: EditorLayoutGroup[],
    orientation: number,
    idCounter: { value: number },
    leafCounter: { value: number },
    allNodes: TreeNode[],
    containerOf: Map<EditorLayoutGroup[], TreeNode | null>,
  ): TreeNode[] {
    const nodes: TreeNode[] = [];

    const childOrientation = 1 - orientation;

    // |_A(id=1,leafIndex=0)_|_B(id=2,lefIndex=1)_|  orientation=1
    // |_C(id=3,leafIndex=2)                      |
    for (const data of siblings) {
      const isLeaf = !data.groups || data.groups.length === 0;

      const treeNode: TreeNode = {
        id: idCounter.value++, // 葉ノード以外の中間ノードも含む
        leafIndex: isLeaf ? leafCounter.value : null,
        node: data, // 現在のノード
        ownArray: siblings, // 兄弟ノード
        rawAbove: null, // 現在のグループから上の位置にあるグループのtreeNodeを指す
        rawBelow: null,
        rawLeft: null,
        rawRight: null,
      };
      if (isLeaf) leafCounter.value++;

      allNodes.push(treeNode); // ノードの格納順
      nodes.push(treeNode); // 兄弟順

      if (!isLeaf) {
        // |A(先頭)|B|
        // |C        | の場合、A（先頭）がcontainerOfのvalueに格納する
        // Aは中間ノードにおけるnodeと葉ノードにおけるnodeの２つがある
        containerOf.set(data.groups!, treeNode); // 兄弟ノード（data.groups）がkeyで、その先頭であり中間ノード（treeNode）がvalue
        this.processArray(data.groups!, childOrientation, idCounter, leafCounter, allNodes, containerOf);
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (orientation === 0) {
        // |A(i=0)|B(i=1)| ... 必ず横方向
        // |C|
        if (i > 0) nodes[i].rawLeft = nodes[i - 1];
        if (i < nodes.length - 1) nodes[i].rawRight = nodes[i + 1];
      } else {
        // |A(i=0)|B| ... 必ず縦方向
        // |C(i=1)|
        if (i > 0) nodes[i].rawAbove = nodes[i - 1];
        if (i < nodes.length - 1) nodes[i].rawBelow = nodes[i + 1];
      }
    }

    return nodes;
  }

  private async buildTree(): Promise<BuiltTree> {
    const layout = (await vscode.commands.executeCommand('vscode.getEditorLayout')) as EditorLayout;

    const allNodes: TreeNode[] = [];
    const containerOf = new Map<EditorLayoutGroup[], TreeNode | null>();
    const idCounter = { value: 0 };
    const leafCounter = { value: 0 };

    containerOf.set(layout.groups, null); // 中間ノード関連

    this.processArray(layout.groups, layout.orientation, idCounter, leafCounter, allNodes, containerOf);

    return { allNodes, layout, containerOf };
  }

  private rawKey(dir: Direction): 'rawAbove' | 'rawBelow' | 'rawLeft' | 'rawRight' {
    switch (dir) {
      case 'above':
        return 'rawAbove';
      case 'below':
        return 'rawBelow';
      case 'left':
        return 'rawLeft';
      case 'right':
        return 'rawRight';
    }
  }

  /** 第1引数のnodeに対してkey方向にnodeが存在するか確認し、存在それば第一引数そのものを返す
   * ただし、すべての葉ノードが各方向のnode情報を持っていないので兄弟ノードに頼って情報を取得する
   * 例えば |A B|
   *        |C  | の場合、Bがbelowの情報を持っていない
   *  そこで、Bの兄弟のAに頼ってbelowの情報を持っていないか確認する
   *  同様にCはrightの情報を持っていないので兄弟のAに頼ってrightの情報を取得する
   */
  private resolveOperateOn(
    node: TreeNode,
    dir: Direction,
    containerOf: Map<EditorLayoutGroup[], TreeNode | null>, // Map<兄弟ノード, 先頭/中間ノード>
  ): TreeNode | null {
    const key = this.rawKey(dir);
    if (node[key] !== null) return node;
    const container = containerOf.get(node.ownArray);
    if (container === undefined || container === null) return null;
    return this.resolveOperateOn(container, dir, containerOf);
  }

  /** operateOnからdir方向にnodeがないか確認し、存在すればその情報を返す */
  private findShrinkTarget(
    operateOn: TreeNode, // shrink対象のノード
    dir: Direction,
    minSize: number,
    containerOf: Map<EditorLayoutGroup[], TreeNode | null>,
  ): { operateOn: TreeNode; adjacent: TreeNode } | null {
    const key = this.rawKey(dir);
    let currentOperateOn = operateOn;

    while (true) {
      let adjacent = currentOperateOn[key];

      while (adjacent) {
        if ((adjacent.node.size ?? 1) > minSize + 1e-6) {
          return { operateOn: currentOperateOn, adjacent };
        }
        adjacent = adjacent[key];
      }

      // adjacentが見つからなかったときは兄弟を頼りに候補がないか確認する
      const container = containerOf.get(currentOperateOn.ownArray);
      if (container === undefined || container === null) return null;

      const promoted = this.resolveOperateOn(container, dir, containerOf);
      if (!promoted) return null;

      currentOperateOn = promoted;
    }
  }

  /** アクティブノード（leaf）と木構造の解析結果（tree）を返す */
  private async getActiveLeaf(): Promise<{ leaf: TreeNode; tree: BuiltTree } | null> {
    const tree = await this.buildTree();

    const activeTabGroup = vscode.window.tabGroups.all.find((g) => g.isActive);
    const activeViewColumn = activeTabGroup?.viewColumn;
    if (activeViewColumn === undefined) return null;

    const leaf = tree.allNodes.find((n) => n.leafIndex === activeViewColumn - 1); // アクティブノード
    if (!leaf) return null;

    return { leaf, tree };
  }

  /** 現在のGroupからウィンドウサイズを拡大/縮小する */
  private async resizeActiveGroupBorder(
    direction: 'left' | 'right' | 'up' | 'down',
    amount: number,
    grow: boolean,
  ): Promise<void> {
    const result = await this.getActiveLeaf();
    if (!result) return;

    const { leaf, tree } = result;
    const dir: Direction = direction === 'up' ? 'above' : direction === 'down' ? 'below' : direction;
    const isHorizontal = direction === 'left' || direction === 'right';
    const minSize = isHorizontal ? this.minWidth : this.minHeight;

    const operateOn = this.resolveOperateOn(leaf, dir, tree.containerOf); // leafはアクティブノード
    if (!operateOn) return;

    if (grow) {
      const shrinkResult = this.findShrinkTarget(operateOn, dir, minSize, tree.containerOf);
      if (!shrinkResult) return;

      // finalOperateOn: アクティブノード（拡大するノード）
      // adjacent: shrinkするノード
      const { operateOn: finalOperateOn, adjacent } = shrinkResult;

      const adjacentSize = adjacent.node.size ?? 1;
      const actualDelta = Math.min(amount, adjacentSize - minSize);
      if (actualDelta <= 0) return;

      finalOperateOn.node.size = (finalOperateOn.node.size ?? 1) + actualDelta;
      adjacent.node.size = adjacentSize - actualDelta;
    } else {
      const key = this.rawKey(dir);
      const adjacent = operateOn[key];
      if (!adjacent) return;

      const operateOnSize = operateOn.node.size ?? 1;
      const actualDelta = Math.min(amount, operateOnSize - minSize);
      if (actualDelta <= 0) return;

      operateOn.node.size = operateOnSize - actualDelta;
      adjacent.node.size = (adjacent.node.size ?? 1) + actualDelta;
    }

    await vscode.commands.executeCommand('vscode.setEditorLayout', tree.layout);
  }
}
