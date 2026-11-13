import type { Dispatch, SetStateAction } from 'react'

declare global {
  type _ = any

  // @see https://youtu.be/QSIXYMIJkQg?si=CyycYgaAGNZCEuYj&t=188
  type TODO = any

  type AnyFunction = (...args: any[]) => any

  type URLType = `http${'s' | ''}://${string}.${string}`
}

declare module 'react' {
  type SetState<S> = Dispatch<SetStateAction<S>>
}
