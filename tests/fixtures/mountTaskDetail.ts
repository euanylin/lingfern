import { createElement, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { TaskDetail } from '../../src/app/TaskDetail';

export function mountTaskDetail(props: ComponentProps<typeof TaskDetail>) {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  const render = (next: ComponentProps<typeof TaskDetail> & { key?: string }) => root.render(createElement(TaskDetail, next));
  render(props);
  return { root, host, render };
}
