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

  // Helper function for DFS
  const dfs = (nodeId: string, group: Set<string>) => {
    visited.add(nodeId);
    group.add(nodeId);

    // Find all connected nodes through edges
    edges.forEach((edge) => {
      if (edge.source === nodeId && !visited.has(edge.target)) {
        dfs(edge.target, group);
      }
      if (edge.target === nodeId && !visited.has(edge.source)) {
        dfs(edge.source, group);
      }
    });
  };

  // Find all connected components
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      const newGroup = new Set<string>();
      dfs(node.id, newGroup);
      groups.push(newGroup);
    }
  });

  return groups;
};

// uses elkjs to give each node a layouted position
export const getLayoutedNodes = async (
  nodes: AllNodeType[],
  edges: EdgeType[],
): Promise<AllNodeType[]> => {
  // Find connected groups
  const groups = findConnectedGroups(nodes, edges);

  // Process each group separately
  let currentY = 0;
  const processedNodes = cloneDeep(nodes);

  for (const group of groups) {
    // Filter nodes and edges for this group
    const groupNodes = nodes.filter((node) => group.has(node.id));
    const groupEdges = edges.filter(
      (edge) => group.has(edge.source) && group.has(edge.target),
    );

    const elkGraph = {
      id: "root",
      layoutOptions,
      children: groupNodes.map((node) => {
        return {
          id: node.id,
          width: node.width || node.measured?.width || NODE_WIDTH,
          height: node.height || node.measured?.height || NODE_HEIGHT,
          targetPosition: "left",
          sourcePosition: "right",
          labels: [{ text: node.id }],
        };
      }),
      edges: groupEdges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    const layout = await elk.layout(elkGraph);

    // Find group boundaries
    let groupMinY = Infinity;
    let groupMaxY = -Infinity;
    let groupHeight = 0;

    layout.children?.forEach((child) => {
      if (typeof child.y === "number") {
        groupMinY = Math.min(groupMinY, child.y);
        groupMaxY = Math.max(groupMaxY, child.y + (child.height || 0));
      }
    });

    groupHeight = groupMaxY - groupMinY;

    // Position nodes within the group
    const nodesByX = {};
    layout.children?.forEach((child) => {
      if (typeof child.x !== "number") return;
      const xCoord = Math.round(child.x);
      if (!nodesByX[xCoord]) {
        nodesByX[xCoord] = [];
      }
      nodesByX[xCoord].push(child);
    });

    // Update node positions with baseline offset
    Object.values(nodesByX).forEach((nodesAtX: any) => {
      let localY = 0;
      nodesAtX.forEach((child: any) => {
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

    // Update currentY for next group using the maximum height of this group
    const maxLocalY = Math.max(
      ...Object.values(nodesByX).map((nodes: any) =>
        nodes.reduce(
          (sum: number, node: any) => sum + (node.height || 0) + NODE_SPACING,
          0,
        ),
      ),
    );
    currentY += maxLocalY + NODE_SPACING * 2; // Add double spacing between groups
  }

  return processedNodes;
};
