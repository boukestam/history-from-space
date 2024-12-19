export function Button({ onClick, children }: { onClick: () => void, children: string }) {
  return (
    <button onClick={onClick} className="text-white">{children}</button>
  );
}