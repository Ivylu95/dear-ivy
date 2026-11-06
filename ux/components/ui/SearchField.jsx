'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';

// The one search box (DES-001 design 3): the rail's "Filter this page", the
// harness index's filter, the Changes search and the spec map's find. It was
// four — two near-copies of the same markup and key handling, and two boxed
// fields of their own — and is now this, in the `.line-filter*` look: a glyph,
// the field, and one rule under them that takes the accent on focus. A boxed
// field was tried in the margins first and was the one filled rectangle in a
// column of bare rows; the line is the answer that already worked there.
//
// type="search" for the browser's own affordances (the right keyboard on a
// touch device), with a clear button of our own, because the native one is
// absent on Firefox and unstyleable on WebKit. It shows on a query, not on
// focus: a way out when there is something to clear, not one more thing
// moving in a narrow column.
//
// Escape empties it, because a query matching nothing looks like an empty list
// and the key a reader will already try is the way out.
//
// Controlled with `value` and `onChange(text)`; or, inside a plain form that
// has to work with scripts off, uncontrolled with `defaultValue` and a `name`,
// so Enter submits the form as it always did. `onEnter` takes Enter over
// instead (jump to the first match). Anything else (`id`, `placeholder`,
// `aria-*`) goes to the input; `clearLabel` names the clear button.
// `className` is for the container's placement only, never for the look.
export function SearchField({
  value,
  defaultValue = '',
  onChange,
  onEnter,
  clearLabel = 'Clear the search',
  className,
  ...input
}) {
  const [own, setOwn] = useState(defaultValue);
  const controlled = value !== undefined;
  const text = controlled ? value : own;
  const field = useRef(null);

  const set = (next) => {
    if (!controlled) setOwn(next);
    onChange?.(next);
  };

  return (
    <div className={className ? `line-filter ${className}` : 'line-filter'}>
      <Icon name="search" size={13} className="line-filter-mark" aria-hidden="true" />
      <input
        ref={field}
        type="search"
        className="line-filter-field"
        value={text}
        onChange={(event) => set(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            set('');
            return;
          }
          if (event.key === 'Enter' && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }}
        spellCheck="false"
        autoComplete="off"
        {...input}
      />
      {text && (
        <button
          type="button"
          className="line-filter-clear"
          onClick={() => {
            set('');
            field.current?.focus();
          }}
          aria-label={clearLabel}
          title={clearLabel}
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  );
}
