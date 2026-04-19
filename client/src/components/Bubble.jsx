import React, { useMemo } from 'react';

const BG_VARS = ['--bub-a', '--bub-b', '--bub-c', '--bub-d', '--bub-e', '--bub-f'];
const FLOAT_CLASSES = ['bubble-float-a', 'bubble-float-b', 'bubble-float-c'];

/**
 * Animated floating bubble.
 *
 * Props:
 *  index        — integer used for colour + animation variant
 *  floating     — if true, applies the float animation
 *  selected     — visual selected state
 *  assigned     — visual assigned (dim) state
 *  dragging     — visual dragging state (slightly transparent)
 *  onClick
 *  children
 *  style        — extra inline style
 *  ...rest      — forwarded to the root div (e.g. draggable, onDragStart, onDragEnd)
 */
export default function Bubble({
  index = 0,
  floating = true,
  selected = false,
  assigned = false,
  dragging = false,
  onClick,
  children,
  style,
  className = '',
  ...rest
}) {
  const dur      = useMemo(() => (3.2 + (index * 0.37) % 1.5).toFixed(2) + 's', [index]);
  const del      = useMemo(() => ((index * 0.53) % 1.8).toFixed(2) + 's', [index]);
  const bg       = `var(${BG_VARS[index % BG_VARS.length]})`;
  const floatCls = floating && !assigned && !dragging
    ? FLOAT_CLASSES[index % FLOAT_CLASSES.length]
    : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={[
        'bubble',
        floatCls,
        selected  ? 'selected'  : '',
        assigned  ? 'assigned'  : '',
        dragging  ? 'dragging'  : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        '--fd': dur,
        '--fd2': del,
        background: bg,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
