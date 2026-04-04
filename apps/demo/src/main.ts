import '@web-editor/component/web-editor-component.css';
import '@web-editor/component';

const editor = document.getElementById('editor') as HTMLElement & { whenReady?: () => Promise<void> };
const status = document.getElementById('status')!;
const wsLabel = document.getElementById('ws-label')!;

const base = editor.getAttribute('lsp-url') ?? '';
wsLabel.textContent = base;

let diagCount = 0;
let cursorLabel = '—';

function renderStatus(): void {
  status.textContent = `诊断: ${diagCount} 条 | 光标: ${cursorLabel}`;
}

editor.addEventListener('lsp-diagnostics', ((ev: CustomEvent<{ markers: unknown[] }>) => {
  diagCount = ev.detail?.markers?.length ?? 0;
  renderStatus();
}) as EventListener);

editor.addEventListener('editor-cursor-position', ((ev: CustomEvent<{ lineNumber: number; column: number }>) => {
  const { lineNumber, column } = ev.detail;
  cursorLabel = `L${lineNumber} C${column}`;
  renderStatus();
}) as EventListener);

void editor.whenReady?.().then(() => {
  cursorLabel = '—（Ctrl+Space 补全）';
  renderStatus();
});
