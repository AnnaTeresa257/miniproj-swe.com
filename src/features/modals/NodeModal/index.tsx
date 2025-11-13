import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";

const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj: Record<string, any> = {};
  nodeRows.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const [modalOpened, setModalOpened] = React.useState(false);
  const setSelectedNode = useGraph(state => state.setSelectedNode); // make sure you have a setter

  const [editMode, setEditMode] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(
    nodeData ? normalizeNodeData(nodeData.text) : ""
  );
  const originalTextRef = React.useRef<NodeData["text"] | null>(null);

  React.useEffect(() => {
    if (nodeData) {
      setInputValue(normalizeNodeData(nodeData.text));
      setEditMode(false);
    }
  }, [nodeData]);

  const handleSave = () => {
    if (!nodeData) return;
    try {
      const parsed = JSON.parse(inputValue);
      nodeData.text.forEach(row => {
        if (row.key && parsed[row.key] !== undefined) {
          row.value = parsed[row.key];
        }
      });
      // update selected node in store so readers of the store have latest data
      if (setSelectedNode) setSelectedNode(nodeData);
      // dispatch a normalized update event so other UI (inline editors, etc.) can react
      window.dispatchEvent(
        new CustomEvent("node:update", { detail: { id: nodeData.id, text: nodeData.text } })
      );
      setEditMode(false);
    } catch (e) {
      alert("Invalid JSON. Please fix your input before saving.");
    }
  };

  const handleCancel = () => {
    // restore in-memory node data to the original snapshot (if any)
    if (nodeData && originalTextRef.current) {
      try {
        nodeData.text = JSON.parse(JSON.stringify(originalTextRef.current));
        // update store so visual node reflects the reverted content
        if (setSelectedNode) setSelectedNode(nodeData);
        window.dispatchEvent(new CustomEvent("node:update", { detail: { id: nodeData.id, text: nodeData.text } }));
      } catch (e) {
        // ignore restore errors
      }
    }

    setInputValue(normalizeNodeData(nodeData?.text ?? []));
    setEditMode(false);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <Text fz="xs" fw={500}>Content</Text>
          <CloseButton onClick={onClose} />
        </Flex>

        {/* Node Content */}
        <ScrollArea.Autosize mah={250} maw={600}>
          {editMode ? (
            <Stack gap="md">
              <Textarea
                placeholder="Enter JSON content"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                minRows={6}
                styles={{ input: { fontFamily: "monospace", fontSize: "12px" } }}
              />
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} color="green">
                  Save
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="md">
              <CodeHighlight
                code={inputValue}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
              <Button
                onClick={() => {
                  // snapshot original text so Cancel can restore it
                  originalTextRef.current = nodeData ? JSON.parse(JSON.stringify(nodeData.text)) : null;
                  setEditMode(true);
                }}
              >
                Edit
              </Button>
            </Stack>
          )}
        </ScrollArea.Autosize>

        {/* JSON Path */}
        <Text fz="xs" fw={500}>JSON Path</Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
                     copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
