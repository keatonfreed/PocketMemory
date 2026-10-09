export default function EmptyState({ icon: Icon, children }) {
  return <div className="empty-state"><Icon size={30} strokeWidth={1.25} aria-hidden="true" /><p>{children}</p></div>
}
