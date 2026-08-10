import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { Header } from '../components/Layout/Header'
import { CommandPalette } from '../components/CommandPalette/CommandPalette'
import { useAppSelector } from '../context/AppContext'
import { renderWithProviders, resetAppEnvironment, STORAGE_KEY } from './testUtils'

function ThemeProbe() {
  const theme = useAppSelector((state) => state.theme)
  return <span data-testid="theme">{theme}</span>
}

function Harness() {
  return (
    <>
      <ThemeProbe />
      <Header />
      <CommandPalette />
    </>
  )
}

function themeButton() {
  return screen.getByRole('button', { name: 'Toggle theme' })
}

function theme() {
  return screen.getByTestId('theme').textContent
}

describe('Header', () => {
  beforeEach(() => {
    resetAppEnvironment()
  })

  it('renders the shell chrome for a signed-out visitor', () => {
    renderWithProviders(<Harness />)

    expect(screen.getByText('DevToolbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/doruksenay/devtoolbox',
    )
  })

  it('starts on the dark theme and applies it to the document', () => {
    renderWithProviders(<Harness />)

    expect(theme()).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('toggles between dark and light', () => {
    renderWithProviders(<Harness />)

    fireEvent.click(themeButton())

    expect(theme()).toBe('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    fireEvent.click(themeButton())

    expect(theme()).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('swaps the sun and moon icons with the theme', () => {
    renderWithProviders(<Harness />)

    // Dark mode offers the sun (switch to light); the sun icon is the only one
    // drawn with a circle.
    expect(themeButton().querySelector('circle')).not.toBeNull()

    fireEvent.click(themeButton())

    expect(themeButton().querySelector('circle')).toBeNull()
    expect(themeButton().querySelector('path')).not.toBeNull()
  })

  it('persists the chosen theme', () => {
    const { unmount } = renderWithProviders(<Harness />)

    fireEvent.click(themeButton())
    unmount()

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { theme?: string }
    expect(saved.theme).toBe('light')

    renderWithProviders(<Harness />)
    expect(theme()).toBe('light')
  })

  it('opens the command palette from the search button', () => {
    renderWithProviders(<Harness />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Search tools…'))

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
  })

  it('opens and closes the sign-in modal', () => {
    renderWithProviders(<Harness />)

    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })
})
