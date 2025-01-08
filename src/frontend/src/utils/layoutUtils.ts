import { NODE_SPACING } from "@/constants/constants";
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

// uses elkjs to give each node a layouted position
export const getLayoutedNodes = async (
  nodes: AllNodeType[],
  edges: EdgeType[],
): Promise<AllNodeType[]> => {
  const elkGraph = {
    id: "root",
    layoutOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
      targetPosition: "left",
      sourcePosition: "right",
      labels: [{ text: node.id }],
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layout = await elk.layout(elkGraph);

  // Find the smallest y-coordinate among all nodes
  let minY = Infinity;
  layout.children?.forEach((child) => {
    if (typeof child.y === "number" && child.y < minY) {
      minY = child.y;
    }
  });

  // Group nodes by x-coordinate
  const nodesByX = {};
  layout.children?.forEach((child) => {
    if (typeof child.x !== "number") return;
    const xCoord = Math.round(child.x); // Round to handle floating point imprecision
    if (!nodesByX[xCoord]) {
      nodesByX[xCoord] = [];
    }
    nodesByX[xCoord].push(child);
  });

  // Position nodes, handling overlaps
  Object.values(nodesByX).forEach((nodesAtX: any) => {
    let currentY = minY;
    nodesAtX.forEach((child: any) => {
      const index = nodes.findIndex((e) => e.id === child.id);
      if (index > -1) {
        nodes[index].position = {
          x: child.x,
          y: currentY,
        };
        // Update currentY for next node, adding a small gap of 20px between nodes
        currentY += child.height + NODE_SPACING;
      }
    });
  });

  return cloneDeep(nodes);
};
