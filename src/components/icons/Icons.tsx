interface IconProps {
  size?: number
  className?: string
}

function Icon({ size = 18, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconEditor(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 5l-3 4 3 4M13 5l3 4-3 4M10 3l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconCompare(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2 9h14M11 5l4 4-4 4M7 5L3 9l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconXml(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 5l3 4-3 4M15 5l-3 4 3 4M8 13l2-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconXmlCompare(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2 9h14M11 5l4 4-4 4M7 5L3 9l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 2l-2 3 2 3M13 2l2 3-2 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconGrid(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </Icon>
  )
}

export function IconQuery(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function IconConvert(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 6h10M10 3l4 3-4 3M14 12H4M8 9l-4 3 4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconHar(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 2v2M9 14v2M2 9h2M14 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </Icon>
  )
}

export function IconCron(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconJwt(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="7" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 7.5l5 5M13 8l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="10" r="1.5" fill="currentColor" />
    </Icon>
  )
}

export function IconDraw(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6.5" y="11" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 7v2M13.5 7v2M4.5 9c0 1.2.8 2 2 2h5c1.2 0 2-.8 2-2M9 9v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function IconYaml(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 4h12M3 8h8M3 12h10M3 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 11v2l1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Icon>
  )
}

export function IconBase64(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 9h2M8 7v4M11 7v4h2M11 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconUrlEnc(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 9a3 3 0 0 0 0 6h1M12 9a3 3 0 0 1 0 6h-1M7 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 3v3M6 4l3 2 3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconSoap(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 8l-2 1 2 1M12 8l2 1-2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 7l-3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Icon>
  )
}

export function IconClean(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M8 2l1.2 2.8L12 6l-2.8 1.2L8 10 6.8 7.2 4 6l2.8-1.2L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 10l.7 1.6L15.3 12l-1.6.4L13 14l-.4-1.6L11 12l1.6-.4L13 10z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconTax(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M11 2H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6l-3-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 8.5l5 5M7 9a.6.6 0 1 0 0-.01M11 13a.6.6 0 1 0 0-.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </Icon>
  )
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M11 4l-6 5 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconChevronRight(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 4l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function IconSun(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4 4l1.5 1.5M12.5 12.5L14 14M4 14l1.5-1.5M12.5 5.5L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function IconMoon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M14 10a6 6 0 0 1-8.5-8.5A6 6 0 1 0 14 10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function IconPalette(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2" y="5" width="4" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="2" width="4" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="5" width="4" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </Icon>
  )
}

export function IconSearch(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function IconGithub(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9 1a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 9 1z" fill="currentColor" />
    </Icon>
  )
}
