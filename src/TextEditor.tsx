import { useEffect, useLayoutEffect, useRef } from "react";
import { blocksFromHtml, normalizeUrl } from "./textFormat";
import type { TextBlock } from "./types";

interface TextEditorProps {
  html: string;
  onChange: (html: string, blocks: TextBlock[]) => void;
  onFocus: () => void;
  onMeasure: (metrics: {
    scrollHeight: number;
    clientHeight: number;
    maxLineLength: number;
    lineCount: number;
  }) => void;
}

function selectionBlock(): HTMLElement | null {
  const selection = window.getSelection();
  let node = selection?.anchorNode ?? null;
  if (node?.nodeType === Node.TEXT_NODE) node = node.parentNode;
  return node instanceof HTMLElement ? node.closest("div, p, h2, li") : null;
}

function placeCursorAtEnd(element: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function maybeTransformMarker(editor: HTMLElement): void {
  let block = selectionBlock();
  if (!block || !editor.contains(block)) return;
  if (block === editor) {
    const wrapper = document.createElement("div");
    while (editor.firstChild) wrapper.appendChild(editor.firstChild);
    editor.appendChild(wrapper);
    block = wrapper;
    placeCursorAtEnd(block);
  }
  const text = (block.textContent ?? "").replace(/\u00a0/g, " ");
  if (text === "# ") {
    const heading = document.createElement("h2");
    heading.innerHTML = "<br>";
    block.replaceWith(heading);
    placeCursorAtEnd(heading);
  } else if (text === "- ") {
    const list = document.createElement("ul");
    const item = document.createElement("li");
    item.innerHTML = "<br>";
    list.appendChild(item);
    block.replaceWith(list);
    placeCursorAtEnd(item);
  } else if (text === "1. ") {
    const list = document.createElement("ol");
    const item = document.createElement("li");
    item.innerHTML = "<br>";
    list.appendChild(item);
    block.replaceWith(list);
    placeCursorAtEnd(item);
  }
}

function sanitizeClipboardHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["DIV", "P", "BR", "STRONG", "B", "EM", "I", "A", "UL", "OL", "LI", "H1", "H2"]);
  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!(element.tagName === "A" && attribute.name.toLowerCase() === "href")) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return template.innerHTML;
}

export function TextEditor({ html, onChange, onFocus, onMeasure }: TextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const measureFrameRef = useRef<number | null>(null);

  const measure = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const lines = editor.innerText.replace(/\u00a0/g, " ").split(/\r?\n/);
    const previousHeight = editor.style.height;
    editor.style.height = "0px";
    const contentHeight = editor.scrollHeight;
    editor.style.height = previousHeight;
    onMeasure({
      scrollHeight: contentHeight,
      clientHeight: editor.clientHeight,
      maxLineLength: Math.max(0, ...lines.map((line) => line.length)),
      lineCount: lines.length,
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== html && document.activeElement !== editor) {
      editor.innerHTML = html;
    }
  }, [html]);

  useEffect(() => () => {
    if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [html]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    maybeTransformMarker(editor);
    onChange(editor.innerHTML, blocksFromHtml(editor.innerHTML));
    if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current);
    measureFrameRef.current = requestAnimationFrame(() => {
      measureFrameRef.current = null;
      measure();
    });
  };

  return (
    <div
      ref={editorRef}
      className="text-editor"
      contentEditable
      role="textbox"
      tabIndex={0}
      suppressContentEditableWarning
      data-placeholder="Write something…"
      spellCheck
      onFocus={onFocus}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        editorRef.current?.focus({ preventScroll: true });
        onFocus();
      }}
      onInput={emitChange}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && ["b", "i"].includes(event.key.toLowerCase())) {
          event.preventDefault();
          document.execCommand(event.key.toLowerCase() === "b" ? "bold" : "italic");
          emitChange();
          return;
        }
        if (event.key === "Tab" && !(event.ctrlKey || event.metaKey) && selectionBlock()?.closest("li")) {
          event.preventDefault();
          document.execCommand(event.shiftKey ? "outdent" : "indent");
          emitChange();
        }
        if (event.key === "Enter") {
          const block = selectionBlock();
          const listItem = block?.closest("li");
          if (listItem) {
            event.preventDefault();
            if (!(listItem.textContent ?? "").trim()) {
              const paragraph = document.createElement("div");
              paragraph.innerHTML = "<br>";
              listItem.closest("ul, ol")!.insertAdjacentElement("afterend", paragraph);
              listItem.remove();
              placeCursorAtEnd(paragraph);
            } else {
              const nextItem = document.createElement("li");
              nextItem.innerHTML = "<br>";
              listItem.insertAdjacentElement("afterend", nextItem);
              placeCursorAtEnd(nextItem);
            }
            emitChange();
            return;
          }
          if (block?.closest("h2")) {
            event.preventDefault();
            const paragraph = document.createElement("div");
            paragraph.innerHTML = "<br>";
            block.closest("h2")!.insertAdjacentElement("afterend", paragraph);
            placeCursorAtEnd(paragraph);
            emitChange();
          }
        }
      }}
      onPaste={(event) => {
        event.stopPropagation();
        const text = event.clipboardData.getData("text/plain");
        const url = normalizeUrl(text);
        event.preventDefault();
        if (url) {
          document.execCommand(
            "insertHTML",
            false,
            `<a href="${url.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer">${text}</a>`,
          );
        } else {
          const rich = event.clipboardData.getData("text/html");
          if (rich) document.execCommand("insertHTML", false, sanitizeClipboardHtml(rich));
          else document.execCommand("insertText", false, text);
        }
        emitChange();
      }}
      onClick={(event) => {
        if (
          event.target instanceof HTMLAnchorElement &&
          (event.ctrlKey || event.metaKey)
        ) {
          event.preventDefault();
          window.open(event.target.href, "_blank", "noopener,noreferrer");
        }
      }}
    />
  );
}
