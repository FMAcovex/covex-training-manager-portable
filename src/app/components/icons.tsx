export type IconName =
  | "home"
  | "training"
  | "calendar"
  | "people"
  | "document"
  | "settings"
  | "clock"
  | "check"
  | "alert"
  | "layers";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M9.5 20v-5h5v5" /></>,
  training: <><path d="m3 8.5 9-4 9 4-9 4-9-4Z" /><path d="M7 10.5V15c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5" /><path d="M21 9v6" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7 3v4M17 3v4M3.5 9.5h17" /></>,
  people: <><path d="M16 20v-1.5c0-2-1.8-3.5-4-3.5H7c-2.2 0-4 1.5-4 3.5V20" /><circle cx="9.5" cy="8.5" r="3.5" /><path d="M16 5.5a3.3 3.3 0 0 1 0 6.2M18 15c1.8.5 3 1.8 3 3.5V20" /></>,
  document: <><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5V8h4M9 12h6M9 16h6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.7-1.7l.9-1.9-2.1-2.1-1.9.9a7 7 0 0 0-1.7-.7l-.7-2h-3l-.7 2a7 7 0 0 0-1.7.7l-1.9-.9-2.1 2.1.9 1.9a7 7 0 0 0-.7 1.7l-2 .7v3l2 .7a7 7 0 0 0 .7 1.7l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.7.7l.7 2h3l.7-2a7 7 0 0 0 1.7-.7l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .7-1.7z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
};

export function AppIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`app-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
