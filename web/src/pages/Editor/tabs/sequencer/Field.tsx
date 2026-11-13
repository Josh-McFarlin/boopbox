// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
//
// A field the user types in: it shows `value` unless it has the focus (a value being typed stays), and reports the
// native change (Enter, leaving it, a spinner click, a choice), as the old page's fields did.
import { useEffect, useRef } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  RefObject,
  SelectHTMLAttributes,
} from 'react'

/* the element a Field is */
export type FieldEl = HTMLInputElement | HTMLSelectElement
export interface FieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement> &
    SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'checked' | 'children'
> {
  as?: 'input' | 'select'
  value?: string | number | null
  checked?: boolean | null
  onCommit?: (el: FieldEl) => void
  children?: ReactNode
}

export default function Field({
  as: Tag = 'input',
  value,
  checked,
  onCommit,
  children,
  ...rest
}: FieldProps) {
  const ref = useRef<FieldEl>(null)
  const cb = useRef(onCommit)
  cb.current = onCommit
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (checked != null) (el as HTMLInputElement).checked = !!checked
    else if (value != null && el.value !== String(value))
      el.value = String(value)
  })
  useEffect(() => {
    const el = ref.current!,
      h = () => cb.current && cb.current(el)
    el.addEventListener('change', h)
    return (): void => el.removeEventListener('change', h)
  }, [])
  if (Tag === 'select')
    return (
      <select ref={ref as RefObject<HTMLSelectElement>} {...rest}>
        {children}
      </select>
    )
  return <input ref={ref as RefObject<HTMLInputElement>} {...rest} />
}
