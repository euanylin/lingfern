import type { ComponentPropsWithRef } from 'react';

type Props = ComponentPropsWithRef<'textarea'> & { submitOnEnter?: boolean };

export function SingleLineField({ onChange, onKeyDown, submitOnEnter, ...props }: Props) {
  // Avoid Android Chrome autofill on text inputs.
  return <textarea {...props} rows={1} wrap="off" aria-multiline={false} data-single-line="" autoComplete="off"
    onChange={event => {
      const field = event.currentTarget;
      const value = field.value.replace(/[\r\n]/g, '');
      if (value !== field.value) {
        const start = field.value.slice(0, field.selectionStart).replace(/[\r\n]/g, '').length;
        const end = field.value.slice(0, field.selectionEnd).replace(/[\r\n]/g, '').length;
        field.value = value;
        field.setSelectionRange(start, end);
      }
      onChange?.(event);
    }}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.key !== 'Enter' || event.nativeEvent.isComposing) return;
      event.preventDefault();
      const form = event.currentTarget.form;
      const submit = form?.querySelector<HTMLButtonElement>('button[type=submit]');
      if (submit) submit.click();
      else if (submitOnEnter) form?.requestSubmit();
    }}/>;
}
