import { NODE_HEIGHT, NODE_SPACING, NODE_WIDTH } from "@/constants/constants";
import { AllNodeType, EdgeType } from "@/types/flow";
import ELK from "elkjs/lib/elk.bundled.js";
import { cloneDeep } from "lodash";

const layoutOptions = {
  "elk.algorithm": "layered",
  "elk.layered.spacing.nodeNodeBetweenLayers": (NODE_SPACING * 2).toString(),
  "elk.spacing.nodeNode": NODE_SPACING.toString(),
  "org.eclipse.elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
};
const elk = new ELK();

const findConnectedGroups = (
  nodes: AllNodeType[],
  edges: EdgeType[],
): Set<string>[] => {
  const groups: Set<string>[] = [];
  const visited = new Set<string>();
  const singleNodes = new Set<string>();

  // First pass: find connected components
  const dfs = (nodeId: string, group: Set<string>) => {
    visited.add(nodeId);
    group.add(nodeId);

    edges.forEach((edge) => {
      if (edge.source === nodeId && !visited.has(edge.target)) {
        dfs(edge.target, group);
      }
      if (edge.target === nodeId && !visited.has(edge.source)) {
        dfs(edge.source, group);
      }
    });
  };

  // Find all connected components first
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      // Check if node is connected to any edges
      const isConnected = edges.some(
        (edge) => edge.source === node.id || edge.target === node.id,
      );

      if (isConnected) {
        const newGroup = new Set<string>();
        dfs(node.id, newGroup);
        groups.push(newGroup);
      } else {
        singleNodes.add(node.id);
      }
    }
  });

  // Add single nodes as the last group if there are any
  if (singleNodes.size > 0) {
    groups.push(singleNodes);
  }

  return groups;
};

// Add these types at the top
type NodesByX = {
  [key: number]: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

type ElkNode = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

// uses elkjs to give each node a layouted position
export const getLayoutedNodes = async (
  nodes: AllNodeType[],
  edges: EdgeType[],
): Promise<AllNodeType[]> => {
  // Filter out note nodes from layout processing
  const nonNoteNodes = nodes.filter((node) => node.type !== "noteNode");
  const noteNodes = nodes.filter((node) => node.type === "noteNode");
  
  const groups = findConnectedGroups(nonNoteNodes, edges);
  let currentY = 0;
  const processedNodes = cloneDeep(nonNoteNodes);

  for (const [groupIndex, group] of Array.from(groups.entries())) {
    const groupNodes = nodes.filter((node) => group.has(node.id));
    const isLastGroup = groupIndex === groups.length - 1;
    const isSingleNodesGroup =
      isLastGroup &&
      !edges.some((edge) => group.has(edge.source) && group.has(edge.target));

    // Create layout edges - including dummy edges for single nodes
    let groupEdges = edges.filter(
      (edge) => group.has(edge.source) && group.has(edge.target),
    );

    if (isSingleNodesGroup && groupNodes.length > 0) {
      // Create dummy edges connecting single nodes in a chain
      const dummyEdges: EdgeType[] = [];
      for (let i = 0; i < groupNodes.length - 1; i++) {
        dummyEdges.push({
          id: `dummy-${i}`,
          source: groupNodes[i].id,
          target: groupNodes[i + 1].id,
        });
      }
      groupEdges = dummyEdges;
    }

    const elkGraph = {
      id: "root",
      layoutOptions: {
        ...layoutOptions,
        // For single nodes group, arrange them in a more compact way
        ...(isSingleNodesGroup && {
          "elk.spacing.nodeNode": (NODE_SPACING / 2).toString(),
        }),
      },
      children: groupNodes.map((node) => ({
        id: node.id,
        width: node.width || node.measured?.width || NODE_WIDTH,
        height: node.height || node.measured?.height || NODE_HEIGHT,
        targetPosition: "left",
        sourcePosition: "right",
        labels: [{ text: node.id }],
      })),
      edges: groupEdges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    const layout = await elk.layout(elkGraph);

    // Position nodes within the group
    const nodesByX: NodesByX = {};
    layout.children?.forEach((child: ElkNode) => {
      if (typeof child.x !== "number") return;
      const xCoord = Math.round(child.x);
      if (!nodesByX[xCoord]) {
        nodesByX[xCoord] = [];
      }
      nodesByX[xCoord].push({
        id: child.id,
        x: child.x,
        y: child.y || 0,
        width: child.width || NODE_WIDTH,
        height: child.height || NODE_HEIGHT,
      });
    });

    // Handle empty nodesByX case
    if (Object.keys(nodesByX).length === 0) {
      continue;
    }

    // Update node positions with baseline offset
    Object.values(nodesByX).forEach((nodesAtX) => {
      let localY = 0;
      nodesAtX.forEach((child) => {
        const index = processedNodes.findIndex((e) => e.id === child.id);
        if (index > -1) {
          processedNodes[index].position = {
            x: child.x,
            y: currentY + localY,
          };
          localY += child.height + NODE_SPACING;
        }
      });
    });

    // Calculate next group position with safe empty array handling
    const maxLocalY = Math.max(
      0,
      ...Object.values(nodesByX).map((nodes) =>
        nodes.reduce((sum, node) => sum + node.height + NODE_SPACING, 0),
      ),
    );
    currentY += maxLocalY + NODE_SPACING * 2;
  }

  // Add note nodes back to the result without changing their positions
  return [...processedNodes, ...cloneDeep(noteNodes)];
};
