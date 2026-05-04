import { resolveApiUrl } from './api-base'

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => {
        render: (container: HTMLElement) => Promise<void>
        close?: () => Promise<void> | void
        isEligible?: () => boolean
      }
    }
  }
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error. Please try again.'
}

export function getGuestTokenFromPath(path: string) {
  const absoluteUrl = new URL(path, window.location.origin)
  return absoluteUrl.searchParams.get('guest_token')
}

export function openHostedCheckout(url: string) {
  const popup = window.open(
    url,
    'tradingagents-checkout',
    'popup=yes,width=520,height=760,resizable=yes,scrollbars=yes',
  )

  if (!popup) {
    return false
  }

  popup.focus()
  return true
}

export async function apiRequest<T>(path: string, init: RequestInit & { guestToken?: string } = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const guestToken = init.guestToken ?? new URLSearchParams(window.location.search).get('guest_token')
  if (guestToken && !headers.has('x-multica-guest-token')) {
    headers.set('x-multica-guest-token', guestToken)
  }

  const response = await fetch(resolveApiUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  })

  const rawText = await response.text()
  const payload = rawText ? JSON.parse(rawText) : null

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Request failed.')
  }

  return payload as T
}

export async function loadPayPalSdk(clientId: string, currency: string) {
  const scriptId = 'paypal-sdk-script'
  const normalizedCurrency = currency.toUpperCase()
  const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(normalizedCurrency)}&intent=capture&components=buttons`
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null

  if (
    existingScript &&
    existingScript.dataset.clientId === clientId &&
    existingScript.dataset.currency === normalizedCurrency &&
    window.paypal
  ) {
    return window.paypal
  }

  if (existingScript) {
    existingScript.remove()
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = scriptId
    script.src = src
    script.async = true
    script.dataset.clientId = clientId
    script.dataset.currency = normalizedCurrency
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('PayPal SDK failed to load.'))
    document.head.appendChild(script)
  })

  if (!window.paypal) {
    throw new Error('PayPal SDK is unavailable.')
  }

  return window.paypal
}
