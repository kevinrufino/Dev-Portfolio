import { createContext, useContext, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * The editing session, reachable from anywhere on the page.
 *
 * A case study is assembled from nested blocks and items, so passing an editor
 * down through it would mean every component on the page growing a prop it
 * only forwards. The context carries it instead, and a page that is not being
 * edited provides nothing — `useEdit()` returns `null`, every editable element
 * renders exactly the markup it always did, and a reader's page is untouched by
 * the existence of this file.
 */

const EditContext = createContext(null);

export const EditProvider = EditContext.Provider;

export const useEdit = () => useContext(EditContext);

/** True only while a page is actually being edited. */
export const useEditing = () => Boolean(useContext(EditContext));

/**
 * A string on the page, edited in place.
 *
 * Off, it is the element it names and nothing else — same tag, same classes,
 * same text — so nothing about the page a reader sees is downstream of this.
 * On, the same element becomes editable and writes its own text back into the
 * working record at `path`.
 *
 * The field is UNCONTROLLED once it exists: React writes its text once, on
 * mount, and never again. A contenteditable re-rendered from the state it is
 * feeding puts the caret back at the end of the line on every keystroke, which
 * makes editing a paragraph in the middle impossible. The cost of that is that
 * a change made somewhere else does not reach a mounted field — which is what
 * the editor's `rev` counter is for: anything that changes the page's shape
 * remounts them all.
 */
const EditableField = ({
  as: Tag,
  path,
  text,
  numeric,
  multiline,
  placeholder,
  onEnter,
  onEmptyBackspace,
  className,
  ...rest
}) => {
  const edit = useEdit();
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.textContent = text ?? '';
    // Once. See the note above.
    // eslint-disable-next-line
  }, []);

  const commit = event => {
    const value = event.currentTarget.textContent ?? '';
    edit.patch(
      path,
      numeric ? Number(value.replace(/[^\d.-]/g, '')) || 0 : value,
    );
  };

  const onKeyDown = event => {
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!multiline) {
        event.currentTarget.blur();
        return;
      }
      // In prose, Enter means "a new paragraph starts here" — so the line is
      // split at the caret rather than a blank one appended after it.
      const node = event.currentTarget;
      const full = node.textContent ?? '';
      const at = window.getSelection?.()?.anchorOffset ?? full.length;
      onEnter?.(full.slice(0, at), full.slice(at));
      return;
    }
    if (
      event.key === 'Backspace' &&
      onEmptyBackspace &&
      !(event.currentTarget.textContent ?? '').length
    ) {
      event.preventDefault();
      onEmptyBackspace();
    }
  };

  // Everything on this page is set in the site's own faces at the site's own
  // sizes; a pasted heading arriving with somebody else's inline markup would
  // be invisible in the editor and wrong in the export, which reads
  // `textContent`. Plain text only, always.
  const onPaste = event => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text.replace(/\s*\n\s*/g, ' '));
  };

  return (
    <Tag
      ref={ref}
      className={`${className} pedit`.trim()}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onInput={commit}
      onBlur={commit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      {...rest}
    />
  );
};

export const Editable = ({
  as: Tag = 'span',
  path,
  children = '',
  className = '',
  ...rest
}) => {
  const edit = useEdit();
  if (!edit) {
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }
  return (
    <EditableField
      as={Tag}
      path={path}
      text={typeof children === 'number' ? String(children) : children}
      className={className}
      {...rest}
    />
  );
};

Editable.propTypes = {
  as: PropTypes.elementType,
  /** Where in the working record this string lives, e.g. ['blocks', 2, 'title']. */
  path: PropTypes.array.isRequired,
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * The controls that hang off a piece of the page in edit mode.
 *
 * Deliberately not a toolbar. A case study is a long document and its
 * structure is only interesting when you are standing next to the part of it
 * you want to change, so the controls live at the edge of that part and appear
 * on approach. Nothing of them is in the DOM when the page is not being edited.
 */
export const EditRail = ({ label = '', actions, className = '' }) => {
  const edit = useEdit();
  if (!edit) return null;
  return (
    <div className={`pedit-rail ${className}`.trim()} contentEditable={false}>
      {label && <span className='pedit-rail__label'>{label}</span>}
      {actions.map(action => (
        <button
          key={action.label}
          type='button'
          title={action.title || action.label}
          disabled={action.disabled}
          className={action.danger ? 'is-danger' : undefined}
          onClick={action.run}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

EditRail.propTypes = {
  label: PropTypes.string,
  actions: PropTypes.array.isRequired,
  className: PropTypes.string,
};
