import { useOutletContext } from 'react-router'

// What AppShell hands to its pages through <Outlet context>. Pages rendered outside the shell (tests) get no-ops.
export type ShellContext = {
  toolbarSlot: HTMLElement | null // next to the page title; pages portal their toolbar here
  recheckApi: () => void // a request just failed: update the API chip now, not at the next 30 s poll
}

const NONE: ShellContext = { toolbarSlot: null, recheckApi: () => {} }

export const useShell = () => useOutletContext<ShellContext | undefined>() ?? NONE
