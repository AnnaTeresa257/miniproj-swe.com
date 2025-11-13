import React from "react";
import styled from "styled-components";
import type { CustomNodeProps } from ".";
import useConfig from "../../../../../store/useConfig";
import { isContentImage } from "../lib/utils/calculateNodeSize";
import { TextRenderer } from "./TextRenderer";
import * as Styled from "./styles";

console.log("✅ TextNode component loaded");

const StyledTextNodeWrapper = styled.span<{ $isParent: boolean }>`
  display: flex;
  justify-content: ${({ $isParent }) => ($isParent ? "center" : "flex-start")};
  align-items: center;
  height: 100%;
  width: 100%;
  overflow: hidden;
  padding: 0 10px;
`;

const StyledImageWrapper = styled.div`
  padding: 5px;
`;

const StyledImage = styled.img`
  border-radius: 2px;
  object-fit: contain;
  background: ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
`;

const Node = ({ node, x, y }: CustomNodeProps) => {
  const { text, width, height } = node;
  const imagePreviewEnabled = useConfig(state => state.imagePreviewEnabled);
  const isImage = imagePreviewEnabled && isContentImage(JSON.stringify(text[0].value));
  const value = text[0].value;

  const [editing, setEditing] = React.useState(false);
  const [inputValue, setInputValue] = React.useState<string>(String(value));
  const [, setVersion] = React.useState(0); // bump to force re-render after saving

  React.useEffect(() => {
    // keep local inputValue in sync if external text changes
    setInputValue(String(text[0]?.value ?? ""));
  }, [text]);

  // Double-click the foreignObject to open a small inline editor overlay.
  React.useEffect(() => {
    if (isImage) return; // keep images read-only for now

    const selector = `[data-id="node-${node.id}"]`;
    const fo = document.querySelector<HTMLElement>(selector);
    if (!fo) return;

    let editorContainer: HTMLDivElement | null = null;

    const cleanup = () => {
      if (editorContainer && editorContainer.parentElement) {
        editorContainer.parentElement.removeChild(editorContainer);
      }
      editorContainer = null;
      setEditing(false);
    };

    const saveEdit = (newVal: string) => {
      try {
        // update the node value in-place
        if (node && node.text && node.text[0]) {
          node.text[0].value = newVal;
        }
      } catch (e) {
        // ignore
      }
      // notify any external listeners (e.g. JSON editor) that this node changed
      window.dispatchEvent(
        new CustomEvent("node:update", { detail: { id: node.id, text: node.text } })
      );
      // force a re-render to pick up mutated node value
      setVersion(v => v + 1);
      cleanup();
    };

    const openEditor = (e?: MouseEvent) => {
      if (editorContainer) return;
      setEditing(true);

      // compute position
      const rect = fo.getBoundingClientRect();
      editorContainer = document.createElement("div");
      editorContainer.style.position = "absolute";
      editorContainer.style.left = `${rect.left + window.scrollX}px`;
      editorContainer.style.top = `${rect.top + window.scrollY}px`;
      editorContainer.style.zIndex = "9999";
      editorContainer.style.background = "transparent";
      editorContainer.id = `node-editor-${node.id}`;

      const input = document.createElement("input");
      input.value = String(text[0]?.value ?? "");
      input.style.width = `${Math.max(120, rect.width - 10)}px`;
      input.style.padding = "4px";
      input.style.border = "1px solid rgba(0,0,0,0.2)";
      input.style.borderRadius = "3px";
      input.addEventListener("input", () => setInputValue(input.value));
      input.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (ev.key === "Enter") {
          saveEdit(input.value);
        } else if (ev.key === "Escape") {
          cleanup();
        }
      });

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      saveBtn.style.marginLeft = "6px";
      saveBtn.onclick = () => saveEdit(input.value);

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.marginLeft = "6px";
      cancelBtn.onclick = () => cleanup();

      editorContainer.appendChild(input);
      editorContainer.appendChild(saveBtn);
      editorContainer.appendChild(cancelBtn);

      document.body.appendChild(editorContainer);
      // focus the input
      setTimeout(() => input.focus(), 0);
    };

    const onDblClick = (ev: MouseEvent) => {
      openEditor(ev);
    };

    fo.addEventListener("dblclick", onDblClick);

    return () => {
      fo.removeEventListener("dblclick", onDblClick);
      cleanup();
    };
  }, [node.id, isImage, text]);

  // Expose a simple programmatic API for other parts of the app if needed.
  // e.g. window.dispatchEvent(new CustomEvent('node:edit', { detail: { id: node.id } }));
  React.useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent;
      if (custom?.detail?.id !== node.id) return;
      // open editor by simulating a dblclick on the node's element
      const fo = document.querySelector<HTMLElement>(`[data-id="node-${node.id}"]`);
      if (isImage) return;
      // Open the inline editor in the React UI (instead of faking a dblclick).
      // This will show the Edit/Save/Cancel controls already rendered by the component.
      setInputValue(String(node.text?.[0]?.value ?? ""));
      setEditing(true);
      // Focus the input once it's mounted
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(`[data-id="node-${node.id}"] input`);
        if (input) input.focus();
      }, 0);
    };
    window.addEventListener("node:edit", handler as EventListener);
    return () => window.removeEventListener("node:edit", handler as EventListener);
  }, [node.id]);


  return (
    <Styled.StyledForeignObject>
      data-id={`node-${node.id}`}
      width={width}
      height={height}
      x={0}
      y={0}
    
  {isImage ? (
  <StyledImageWrapper>
    <StyledImage src={JSON.stringify(text[0].value)} width="70" height="70" loading="lazy" />
  </StyledImageWrapper>
) : (
  <StyledTextNodeWrapper
    data-x={x}
    data-y={y}
    data-key={JSON.stringify(text)}
    $isParent={false}
onDoubleClick={() => {
  window.dispatchEvent(new CustomEvent("node:edit", { detail: { id: node.id } }));
}}  >
    {editing ? (
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          style={{
            padding: "4px",
            border: "1px solid rgba(0,0,0,0.2)",
            borderRadius: "3px",
            width: "100px",
          }}
        />
        <button
          onClick={() => {
            if (node.text && node.text[0]) node.text[0].value = inputValue;
            window.dispatchEvent(
              new CustomEvent("node:update", { detail: { id: node.id, text: node.text } })
            );
            setEditing(false);
          }}
        >
          Save
        </button>
        <button onClick={() => setEditing(false)}>Cancel</button>
      </div>
    ) : (
      <>
        <Styled.StyledKey $value={value} $type={typeof text[0].value}>
          <TextRenderer>{value}</TextRenderer>
        </Styled.StyledKey>
        <button
          style={{
            marginLeft: "6px",
            padding: "2px 6px",
            border: "1px solid #ccc",
            borderRadius: "3px",
            background: "#eee",
          }}
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      </>
    )}
  </StyledTextNodeWrapper>
)}   </Styled.StyledForeignObject>
  );
};


function propsAreEqual(prev: CustomNodeProps, next: CustomNodeProps) {
  return prev.node.text === next.node.text && prev.node.width === next.node.width;
}

export const TextNode = React.memo(Node, propsAreEqual);
